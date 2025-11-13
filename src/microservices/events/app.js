const express = require('express');
const { Kafka } = require('kafkajs');
const cors = require('cors');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8082;

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Kafka configuration
const kafka = new Kafka({
  clientId: 'events-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'events-service-group' });

// Connect to Kafka on startup
const connectKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    
    // Subscribe to topics
    await consumer.subscribe({ topic: 'user_events', fromBeginning: true });
    await consumer.subscribe({ topic: 'payment_events', fromBeginning: true });
    await consumer.subscribe({ topic: 'movie_events', fromBeginning: true });
    
    console.log('Connected to Kafka successfully');
    
    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const eventData = JSON.parse(message.value.toString());
        console.log(`📩 Consumed event from ${topic}:`, {
          partition,
          offset: message.offset,
          event: eventData
        });
      },
    });
  } catch (error) {
    console.error('Kafka connection error:', error);
    setTimeout(connectKafka, 5000);
  }
};

// Health check
app.get('/api/events/health', async (req, res) => {
  const kafkaStatus = producer ? 'connected' : 'disconnected';
  res.json({ 
    status: true,
    service: 'events',
    kafka: kafkaStatus
  });
});

// Event endpoints
app.post('/api/events/user', async (req, res) => {
  try {
    const event = {
      id: uuidv4(),
      type: 'USER_EVENT',
      action: req.body.action || 'unknown',
      user_id: req.body.user_id,
      timestamp: req.body.timestamp || new Date().toISOString(),
      data: req.body
    };

    await producer.send({
      topic: 'user_events',
      messages: [
        {
          key: event.user_id?.toString() || 'unknown',
          value: JSON.stringify(event)
        }
      ]
    });

    console.log('User event produced:', event);
    res.status(201).json({
      status: 'success',
      event: event
    });
  } catch (error) {
    console.error('Failed to create user event:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/payment', async (req, res) => {
  try {
    const event = {
      id: uuidv4(),
      type: 'PAYMENT_EVENT',
      action: req.body.action || 'unknown',
      payment_id: req.body.payment_id,
      user_id: req.body.user_id,
      amount: req.body.amount,
      timestamp: req.body.timestamp || new Date().toISOString(),
      data: req.body
    };

    await producer.send({
      topic: 'payment_events',
      messages: [
        {
          key: event.payment_id?.toString() || 'unknown',
          value: JSON.stringify(event)
        }
      ]
    });

    console.log('Payment event produced:', event);
    res.status(201).json({
      status: 'success',
      event: event
    });
  } catch (error) {
    console.error('Failed to create payment event:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/movie', async (req, res) => {
  try {
    const event = {
      id: uuidv4(),
      type: 'MOVIE_EVENT',
      action: req.body.action || 'unknown',
      movie_id: req.body.movie_id,
      user_id: req.body.user_id,
      rating: req.body.rating,
      timestamp: req.body.timestamp || new Date().toISOString(),
      data: req.body
    };

    await producer.send({
      topic: 'movie_events',
      messages: [
        {
          key: event.movie_id?.toString() || 'unknown',
          value: JSON.stringify(event)
        }
      ]
    });

    console.log('Movie event produced:', event);
    res.status(201).json({
      status: 'success',
      event: event
    });
  } catch (error) {
    console.error('Failed to create movie event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get events statistics
app.get('/api/events/stats', async (req, res) => {
  try {
    const admin = kafka.admin();
    await admin.connect();
    
    const topics = await admin.listTopics();
    const topicMetadata = await admin.fetchTopicMetadata({ topics: ['user_events', 'payment_events', 'movie_events'] });
    
    await admin.disconnect();
    
    res.json({
      topics: topicMetadata.topics.map(topic => ({
        name: topic.name,
        partitions: topic.partitions.length
      }))
    });
  } catch (error) {
    console.error('Failed to get event stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Events service running on port ${PORT}`);
  await connectKafka();
});