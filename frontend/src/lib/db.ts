import { MongoClient, Db } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'moogle_meet';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function getDb(): Promise<Db> {
  if (dbInstance) return dbInstance;
  if (!client) {
    client = new MongoClient(MONGO_URL);
    await client.connect();
  }
  dbInstance = client.db(DB_NAME);

  // Create indexes once
  try {
    await dbInstance.collection('experts').createIndex({ clerkUserId: 1 }, { unique: true, sparse: true });
    await dbInstance.collection('experts').createIndex({ email: 1 }, { unique: true });
    await dbInstance.collection('plans').createIndex({ name: 1 }, { unique: true });
    await dbInstance.collection('fake_profiles').createIndex({ expertId: 1 });
    await dbInstance.collection('scheduled_comments').createIndex({ meetingId: 1 });
  } catch {
    /* ignore index errors */
  }

  // Seed a default plan if none exists
  const plansCount = await dbInstance.collection('plans').countDocuments();
  if (plansCount === 0) {
    await dbInstance.collection('plans').insertMany([
      { name: 'Free', maxFakeParticipants: 5, maxComments: 10, price: 0, active: true, createdAt: new Date() },
      { name: 'Pro', maxFakeParticipants: 30, maxComments: 100, price: 49, active: true, createdAt: new Date() },
      { name: 'Premium', maxFakeParticipants: 100, maxComments: 500, price: 199, active: true, createdAt: new Date() },
    ]);
  }

  return dbInstance;
}

export type Plan = {
  _id?: any;
  name: string;
  maxFakeParticipants: number;
  maxComments: number;
  price: number;
  active: boolean;
  createdAt: Date;
};

export type Expert = {
  _id?: any;
  clerkUserId?: string;
  email: string;
  name: string;
  planId?: string;
  active: boolean;
  createdAt: Date;
};

export type FakeProfile = {
  _id?: any;
  expertId: string;
  meetingId?: string;
  name: string;
  avatarColor: string;
  imageUrl?: string;
  active: boolean;
  createdAt: Date;
};

export type ScheduledComment = {
  _id?: any;
  expertId: string;
  meetingId: string;
  fakeProfileId: string;
  text: string;
  delaySeconds: number;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
};
