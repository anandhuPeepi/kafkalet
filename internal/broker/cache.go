package broker

import (
	"sync"
	"time"
)

// MetaCache is a per-broker TTL cache for metadata RPCs.
// Entries self-expire on read — no background reaper needed.
type MetaCache struct {
	mu      sync.Mutex
	brokers map[string]*brokerCache

	TopicsTTL       time.Duration
	ClusterInfoTTL  time.Duration
	ClusterStatsTTL time.Duration
}

type brokerCache struct {
	topics       *cacheEntry[[]Topic]
	clusterInfo  *cacheEntry[ClusterInfo]
	clusterStats *cacheEntry[ClusterStats]
}

type cacheEntry[T any] struct {
	value     T
	expiresAt time.Time
}

func (e *cacheEntry[T]) valid() bool {
	return e != nil && time.Now().Before(e.expiresAt)
}

// NewMetaCache creates a MetaCache with default TTLs.
func NewMetaCache() *MetaCache {
	return &MetaCache{
		brokers:         make(map[string]*brokerCache),
		TopicsTTL:       30 * time.Second,
		ClusterInfoTTL:  60 * time.Second,
		ClusterStatsTTL: 15 * time.Second,
	}
}

func (c *MetaCache) broker(id string) *brokerCache {
	bc, ok := c.brokers[id]
	if !ok {
		bc = &brokerCache{}
		c.brokers[id] = bc
	}
	return bc
}

// GetTopics returns cached topics for a broker, if still valid.
func (c *MetaCache) GetTopics(brokerID string) ([]Topic, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	bc := c.brokers[brokerID]
	if bc == nil || !bc.topics.valid() {
		return nil, false
	}
	return bc.topics.value, true
}

// SetTopics stores topics in cache with TopicsTTL.
func (c *MetaCache) SetTopics(brokerID string, topics []Topic) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.broker(brokerID).topics = &cacheEntry[[]Topic]{
		value:     topics,
		expiresAt: time.Now().Add(c.TopicsTTL),
	}
}

// GetClusterInfo returns cached cluster info for a broker, if still valid.
func (c *MetaCache) GetClusterInfo(brokerID string) (ClusterInfo, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	bc := c.brokers[brokerID]
	if bc == nil || !bc.clusterInfo.valid() {
		return ClusterInfo{}, false
	}
	return bc.clusterInfo.value, true
}

// SetClusterInfo stores cluster info in cache with ClusterInfoTTL.
func (c *MetaCache) SetClusterInfo(brokerID string, info ClusterInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.broker(brokerID).clusterInfo = &cacheEntry[ClusterInfo]{
		value:     info,
		expiresAt: time.Now().Add(c.ClusterInfoTTL),
	}
}

// GetClusterStats returns cached cluster stats for a broker, if still valid.
func (c *MetaCache) GetClusterStats(brokerID string) (ClusterStats, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	bc := c.brokers[brokerID]
	if bc == nil || !bc.clusterStats.valid() {
		return ClusterStats{}, false
	}
	return bc.clusterStats.value, true
}

// SetClusterStats stores cluster stats in cache with ClusterStatsTTL.
func (c *MetaCache) SetClusterStats(brokerID string, stats ClusterStats) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.broker(brokerID).clusterStats = &cacheEntry[ClusterStats]{
		value:     stats,
		expiresAt: time.Now().Add(c.ClusterStatsTTL),
	}
}

// InvalidateTopics clears topics and clusterStats for a broker
// (stats contain topic count, so they must be invalidated together).
func (c *MetaCache) InvalidateTopics(brokerID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if bc, ok := c.brokers[brokerID]; ok {
		bc.topics = nil
		bc.clusterStats = nil
	}
}

// InvalidateBroker clears all cached data for a specific broker.
func (c *MetaCache) InvalidateBroker(brokerID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.brokers, brokerID)
}

// InvalidateAll clears all cached data (e.g. on profile switch).
func (c *MetaCache) InvalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.brokers = make(map[string]*brokerCache)
}
