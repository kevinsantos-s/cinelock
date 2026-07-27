import { Kafka, type Consumer, type Producer } from 'kafkajs';
import { env } from './env.js';

const kafka = new Kafka({
  clientId: 'cinelock',
  brokers: env.KAFKA_BROKERS.split(','),
});

let producer: Producer | null = null;

export async function connectProducer(): Promise<void> {
  producer = kafka.producer();
  await producer.connect();
}

async function getProducer(): Promise<Producer> {
  if (!producer) {
    await connectProducer();
  }
  if (!producer) {
    throw new Error('Kafka producer não conectado');
  }
  return producer;
}

// Chave por sessão: garante que eventos da mesma sessão caem na mesma partição,
// preservando a ordem (created antes de confirmed) que o consumer depende.
export async function publish(topic: string, key: string, message: unknown): Promise<void> {
  const activeProducer = await getProducer();
  await activeProducer.send({ topic, messages: [{ key, value: JSON.stringify(message) }] });
}

export function createConsumer(groupId: string): Consumer {
  return kafka.consumer({ groupId });
}
