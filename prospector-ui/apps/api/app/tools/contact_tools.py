"""Contact management tools for querying the Apollo contacts database."""

import csv
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
from langchain_core.tools import tool


# Database path - using the LibSQL database from the Next.js project
DB_PATH = Path(__file__).parent.parent.parent.parent / "mastra.db"
CSV_PATH = Path(__file__).parent.parent.parent.parent / "data" / "apollo-contacts-export.csv"


def get_db_connection() -> sqlite3.Connection:
    """Get a connection to the contacts database."""
    return sqlite3.connect(str(DB_PATH))


def load_contacts_from_csv() -> List[Dict[str, Any]]:
    """Load contacts from the Apollo CSV export."""
    contacts = []

    if not CSV_PATH.exists():
        return contacts

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            contacts.append(transform_apollo_to_contact(row))

    return contacts


def transform_apollo_to_contact(record: Dict[str, str]) -> Dict[str, Any]:
    """Transform Apollo CSV record to contact dictionary."""
    quality_score = calculate_quality_score(record)
    is_executive = is_executive_contact(record)
    contact_state = determine_contact_state(record)

    # Parse arrays
    technologies = [t.strip() for t in record.get('Technologies', '').split(',') if t.strip()]
    keywords = [k.strip() for k in record.get('Keywords', '').split(',') if k.strip()]

    # Determine company size bucket
    company_size = int(record.get('# Employees', '0') or '0')
    if company_size <= 10:
        size_bucket = '1-10 (Micro)'
    elif company_size <= 50:
        size_bucket = '11-50 (Small)'
    elif company_size <= 200:
        size_bucket = '51-200 (Medium)'
    elif company_size <= 500:
        size_bucket = '201-500 (Large)'
    else:
        size_bucket = '500+ (Enterprise)'

    return {
        'id': record.get('Apollo Contact Id', ''),
        'firstName': record.get('First Name'),
        'lastName': record.get('Last Name'),
        'email': record.get('Email', ''),
        'emailStatus': record.get('Email Status', 'User Managed'),
        'title': record.get('Title'),
        'seniority': record.get('Seniority'),
        'linkedinUrl': record.get('Person Linkedin Url'),
        'country': record.get('Country'),
        'city': record.get('City'),
        'companyName': record.get('Company Name'),
        'companyWebsite': record.get('Website'),
        'companySize': company_size,
        'companySizeBucket': size_bucket,
        'industry': record.get('Industry'),
        'technologies': technologies,
        'keywords': keywords,
        'stage': record.get('Stage', 'Cold'),
        'contactState': contact_state,
        'qualityScore': quality_score,
        'isExecutive': is_executive,
    }


def calculate_quality_score(record: Dict[str, str]) -> int:
    """Calculate quality score based on data completeness."""
    score = 0

    # Basic info (40 points)
    if record.get('First Name'): score += 5
    if record.get('Last Name'): score += 5
    if record.get('Email'): score += 10
    if record.get('Title'): score += 10
    if record.get('Company Name'): score += 10

    # Contact details (20 points)
    if record.get('Person Linkedin Url'): score += 10
    if record.get('Mobile Phone') or record.get('Work Direct Phone'): score += 10

    # Rich data (20 points)
    if record.get('Keywords'): score += 5
    if record.get('Technologies'): score += 5
    if record.get('Industry'): score += 5
    if record.get('# Employees'): score += 5

    # Verification (20 points)
    if record.get('Email Status') == 'Verified': score += 10
    if record.get('Primary Email Catch-all Status') == 'Not Catch-all': score += 10

    return score


def determine_contact_state(record: Dict[str, str]) -> str:
    """Determine current contact state based on interactions."""
    replied = record.get('Replied') in ['true', 'True', True]
    demoed = record.get('Demoed') in ['true', 'True', True]
    bounced = record.get('Email Bounced') in ['true', 'True', True]
    opened = record.get('Email Open') in ['true', 'True', True]
    sent = record.get('Email Sent') in ['true', 'True', True]
    has_email = bool(record.get('Email'))
    stage = record.get('Stage', '')

    if replied: return 'REPLIED'
    if demoed: return 'DEMOED'
    if bounced: return 'BOUNCED'
    if opened: return 'OPENED'
    if sent: return 'SENT'
    if has_email:
        if stage == 'Interested': return 'INTERESTED_NOT_CONTACTED'
        return 'NOT_CONTACTED'
    return 'INCOMPLETE'


def is_executive_contact(record: Dict[str, str]) -> bool:
    """Check if contact is executive level."""
    seniority = record.get('Seniority', '').lower()
    title = record.get('Title', '').lower()

    executive_keywords = ['suite', 'founder', 'ceo', 'cto', 'cfo', 'coo', 'chief']

    return any(keyword in seniority or keyword in title for keyword in executive_keywords)


@tool
def query_contacts_tool(
    where_clauses: Optional[List[Dict[str, Any]]] = None,
    min_quality_score: Optional[int] = None,
    is_executive: Optional[bool] = None,
    country: Optional[str] = None,
    industry: Optional[str] = None,
    contact_state: Optional[str] = None,
    limit: int = 50
) -> Dict[str, Any]:
    """Query and filter contacts from the Apollo export.

    Args:
        where_clauses: List of filter clauses like [{"field": "keywords", "operator": "contains", "value": "fintech"}]
        min_quality_score: Minimum quality score (0-100)
        is_executive: Filter by executive status
        country: Filter by country
        industry: Filter by industry
        contact_state: Filter by contact state (NOT_CONTACTED, SENT, REPLIED, etc.)
        limit: Maximum number of contacts to return (default 50)

    Returns:
        Dictionary with contacts list, total count, and metadata
    """
    contacts = load_contacts_from_csv()

    # Apply filters
    if min_quality_score is not None:
        contacts = [c for c in contacts if c['qualityScore'] >= min_quality_score]

    if is_executive is not None:
        contacts = [c for c in contacts if c['isExecutive'] == is_executive]

    if country:
        contacts = [c for c in contacts if c.get('country') == country]

    if industry:
        contacts = [c for c in contacts if c.get('industry') == industry]

    if contact_state:
        contacts = [c for c in contacts if c.get('contactState') == contact_state]

    # Apply where clauses (simplified version)
    if where_clauses:
        for clause in where_clauses:
            field = clause.get('field')
            operator = clause.get('operator')
            value = clause.get('value')

            if operator == 'contains' and field:
                contacts = [
                    c for c in contacts
                    if field in c and c[field] and value.lower() in str(c[field]).lower()
                ]
            elif operator == 'equals' and field:
                contacts = [c for c in contacts if c.get(field) == value]
            elif operator == 'gte' and field:
                contacts = [c for c in contacts if c.get(field, 0) >= value]

    # Apply limit
    limited = contacts[:limit]

    # Return minimal fields to save context
    minimal = [
        {
            'id': c['id'],
            'firstName': c.get('firstName'),
            'lastName': c.get('lastName'),
            'email': c['email'],
            'title': c.get('title'),
            'companyName': c.get('companyName'),
            'industry': c.get('industry'),
            'country': c.get('country'),
            'qualityScore': c['qualityScore'],
            'isExecutive': c['isExecutive'],
            'contactState': c['contactState'],
        }
        for c in limited
    ]

    return {
        'contacts': minimal,
        'total': len(contacts),
        'returned': len(minimal),
        'filters_applied': {
            'min_quality_score': min_quality_score,
            'is_executive': is_executive,
            'country': country,
            'industry': industry,
            'contact_state': contact_state,
        }
    }


@tool
def get_contact_stats_tool(group_by: Optional[str] = None) -> Dict[str, Any]:
    """Get summary statistics about the contact database.

    Args:
        group_by: Field to group statistics by (e.g., 'industry', 'country', 'contactState')

    Returns:
        Dictionary with database statistics
    """
    contacts = load_contacts_from_csv()

    # Count by state
    by_state = {}
    for c in contacts:
        state = c.get('contactState', 'UNKNOWN')
        by_state[state] = by_state.get(state, 0) + 1

    # Count by stage
    by_stage = {}
    for c in contacts:
        stage = c.get('stage', 'Unknown')
        by_stage[stage] = by_stage.get(stage, 0) + 1

    # High value targets
    executives = sum(1 for c in contacts if c['isExecutive'])
    verified_not_contacted = sum(
        1 for c in contacts
        if c.get('emailStatus') == 'Verified' and c['contactState'] == 'NOT_CONTACTED'
    )
    high_quality_not_contacted = sum(
        1 for c in contacts
        if c['qualityScore'] >= 70 and c['contactState'] in ['NOT_CONTACTED', 'INTERESTED_NOT_CONTACTED']
    )

    # Average quality score
    avg_quality = sum(c['qualityScore'] for c in contacts) / len(contacts) if contacts else 0

    # Optional breakdown
    breakdown = None
    if group_by:
        breakdown = {}
        for c in contacts:
            key = str(c.get(group_by, 'Unknown'))
            breakdown[key] = breakdown.get(key, 0) + 1

    return {
        'total': len(contacts),
        'byState': by_state,
        'byStage': by_stage,
        'highValueTargets': {
            'executives': executives,
            'verifiedNotContacted': verified_not_contacted,
            'highQualityNotContacted': high_quality_not_contacted,
        },
        'avgQualityScore': round(avg_quality, 1),
        'breakdown': breakdown,
    }


@tool
def vector_search_contacts_tool(
    query: str,
    top_k: int = 20,
    min_quality_score: Optional[int] = None,
    is_executive: Optional[bool] = None,
    country: Optional[str] = None
) -> Dict[str, Any]:
    """Perform semantic vector search to find contacts based on natural language queries.

    Args:
        query: Natural language search query (e.g., "Find contacts similar to fintech payment companies")
        top_k: Number of similar contacts to return
        min_quality_score: Minimum quality score filter
        is_executive: Filter by executive status
        country: Filter by country

    Returns:
        Dictionary with matched contacts and similarity scores

    Note: This requires vector embeddings to be generated first.
    For now, falls back to keyword search.
    """
    # TODO: Implement actual vector search once embeddings are set up
    # For now, use keyword-based search as fallback

    # Extract key terms from query
    query_lower = query.lower()
    keywords = []

    # Common terms to extract
    terms = ['fintech', 'payment', 'saas', 'travel', 'cfo', 'ceo', 'executive', 'colombia', 'mexico']
    keywords = [term for term in terms if term in query_lower]

    contacts = load_contacts_from_csv()

    # Score contacts based on keyword relevance
    scored_contacts = []
    for c in contacts:
        score = 0
        text = ' '.join([
            c.get('title', ''),
            c.get('companyName', ''),
            c.get('industry', ''),
            ' '.join(c.get('keywords', [])),
            ' '.join(c.get('technologies', []))
        ]).lower()

        for keyword in keywords:
            if keyword in text:
                score += 1

        if score > 0:
            scored_contacts.append((c, score))

    # Sort by score
    scored_contacts.sort(key=lambda x: x[1], reverse=True)

    # Apply filters
    filtered = []
    for c, score in scored_contacts:
        if min_quality_score and c['qualityScore'] < min_quality_score:
            continue
        if is_executive is not None and c['isExecutive'] != is_executive:
            continue
        if country and c.get('country') != country:
            continue

        filtered.append((c, score))

    # Limit results
    filtered = filtered[:top_k]

    # Return minimal fields
    results = [
        {
            'id': c['id'],
            'firstName': c.get('firstName'),
            'lastName': c.get('lastName'),
            'email': c['email'],
            'title': c.get('title'),
            'companyName': c.get('companyName'),
            'industry': c.get('industry'),
            'country': c.get('country'),
            'qualityScore': c['qualityScore'],
            'isExecutive': c['isExecutive'],
            'contactState': c['contactState'],
            'relevanceScore': score / len(keywords) if keywords else 0,
        }
        for c, score in filtered
    ]

    return {
        'contacts': results,
        'totalMatched': len(results),
        'searchQuery': query,
        'extractedKeywords': keywords,
        'note': 'Using keyword-based fallback. Run embedding generation for true semantic search.',
    }
