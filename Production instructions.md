# Property Scraper – Production Considerations

This document outlines how the property scraper would be operated and maintained in a production environment.

---

## 1. Scaling to Hundreds of Thousands of Listings

To support large-scale crawling, the scraper should be split into independent components rather than running as a single process.

### Architecture

Sitemaps
↓
URL Discovery Service
↓
Queue
↓
Scraper Workers
↓
Database

### Components

#### URL Discovery Service

Responsible for:

- Reading `robots.txt`
- Discovering sitemap URLs
- Parsing sitemap files
- Extracting listing URLs
- Deduplicating URLs before enqueueing

#### Queue

Examples:

- RabbitMQ
- Amazon SQS
- BullMQ / Redis

The queue decouples URL discovery from scraping and allows workers to scale independently.

#### Scraper Workers

Workers:

- Pull URLs from the queue
- Download listing pages
- Extract structured data
- Store results in the database

Multiple workers can run simultaneously.

### Scaling Strategy

- Run scraper workers in containers.
- Deploy workers on Kubernetes, AWS ECS, Docker Swarm, or similar infrastructure.
- Scale horizontally based on queue length.
- Use retries with exponential backoff.
- Respect website rate limits.
- Maintain URL deduplication.

### Example

100,000 URLs
↓
Queue
↓
20 Workers
↓
Parallel Processing

Increasing throughput only requires adding additional workers.

---

## 2. Tracking Price Changes Over Time

Property prices should never be overwritten directly.

Instead, every scrape should create a historical snapshot.

### Database Design

#### Listings

```sql
CREATE TABLE listings (
    id BIGINT PRIMARY KEY,
    url TEXT UNIQUE,
    address TEXT,
    property_type TEXT,
    bedrooms INT,
    estate_agent TEXT,
    first_seen_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    active BOOLEAN
);
```

#### Images

```sql
CREATE TABLE listing_images (
    id BIGINT PRIMARY KEY,
    listing_id BIGINT,
    image_url TEXT
);
```

### Benefits

- Track price reductions.
- Track price increases.
- Calculate time on market.
- Analyze historical trends.
- Detect removed listings.
- Detect relisted properties.

---

---

## 3. Identifying Silent Data-Quality Issues

The scraper may still return HTTP 200 responses while extracting incorrect data.

This type of issue is often caused by HTML layout changes.

### Validation Rules

| Field        | Validation            |
| ------------ | --------------------- |
| URL          | Required              |
| Address      | Required              |
| Price        | Valid currency format |
| Bedrooms     | Numeric               |
| Images       | Valid URL             |
| Description  | Minimum length        |
| Estate Agent | Not empty             |

### Quality Metrics

Monitor the percentage of missing fields.

Examples:

- Missing price rate
- Missing address rate
- Missing bedrooms rate
- Missing images rate
- Missing description rate

### Alert Examples

#### Price Missing

```text
Price missing rate > 10%
```

Trigger alert.

#### Address Missing

```text
Address missing rate > 5%
```

Trigger alert.

#### Description Quality

```text
Average description length drops by 70%
```

Trigger alert.

These checks often detect website changes before the scraper completely fails.

---

## 4. Monitoring Extraction Accuracy

Operational success does not guarantee extraction accuracy.

The scraper must continuously validate the correctness of extracted values.

### Multi-Layer Extraction Strategy

Critical fields should use multiple extraction methods.

```text
JSON-LD
    ↓
CSS Selectors
    ↓
Regex Fallback
```

If extraction methods disagree:

```text
Flag Listing
      ↓
Review Required
```

### Additional Monitoring

Store:

- Raw HTML
- HTML checksum/hash
- Extracted output

This enables quick comparison when extraction accuracy suddenly decreases.

---

## Summary

The production scraper should be designed as a distributed system with:

- Sitemap-based URL discovery
- Queue-based processing
- Horizontally scalable workers
- Historical price tracking
- Automated health monitoring
- Data quality validation
- Extraction accuracy measurement

The most important production concern is not simply whether the scraper is running, but whether it continues to extract complete and accurate property data.
