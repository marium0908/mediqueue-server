import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'mediqueue-secret-key-2026';

// Load Firebase Config
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// Force project ID in environment to ensure Firestore picks up the correct project
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCP_PROJECT = firebaseConfig.projectId;

// Initialize Firebase Admin
let adminApp;
try {
  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
  } else {
    // Explicitly use projectId from config to avoid environment mismatches
    adminApp = initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log(`[Server] Admin App initialized for project: ${firebaseConfig.projectId}`);
  }
} catch (e) {
  console.error("[Server] Init Error:", e.message);
  adminApp = getApps().length > 0 ? getApp() : null;
}

// Global db instance
let db;
let FieldValue = admin.firestore.FieldValue;

// Mock FieldValue for Sandbox Failover
const MockFieldValue = {
  serverTimestamp: () => ({ _methodName: "serverTimestamp" }),
  increment: (val) => ({ _methodName: "increment", _val: val })
};

// Mock Firestore for Sandbox Failover
class MockFirestore {
  constructor(filePath = path.resolve(process.cwd(), "db_local.json")) {
    this.filePath = filePath;
    this.data = { users: [], tutors: [], bookings: [] };
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = [];
        if (!this.data.tutors) this.data.tutors = [];
        if (!this.data.bookings) this.data.bookings = [];
      } else {
        this.save();
      }
    } catch (e) {
      console.warn("[LocalDB] Error loading local DB:", e.message);
    }
    if (!this.data.tutors || this.data.tutors.length === 0) {
      this.seedDefaultLocalTutors();
    }
  }

  seedDefaultLocalTutors() {
    console.log("[LocalDB] Seeding default tutors...");
    this.data.tutors = [
      {
        id: "t_1",
        name: "Dr. Sarah Johnson",
        photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop",
        subject: "Biology",
        hourlyFee: 50,
        totalSlot: 10,
        details: "PhD in Molecular Biology with 10 years of teaching experience.",
        experience: "10+ years in academia and research.",
        availableDays: "Mon, Wed, Fri",
        availableTime: "10:00 AM - 2:00 PM",
        ownerId: "system-Sarah",
        ownerEmail: "system@mediqueue.app",
        teachingMode: "Online",
        institution: "Stanford University",
        location: "Palo Alto, CA",
        sessionStartDate: "2026-06-01",
        createdAt: new Date().toISOString()
      },
      {
        id: "t_2",
        name: "Prof. Michael Chen",
        photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070&auto=format&fit=crop",
        subject: "Physics",
        hourlyFee: 75,
        totalSlot: 5,
        details: "Specialist in Theoretical Physics and Quantum Mechanics.",
        experience: "Lead researcher at CERN for 5 years.",
        availableDays: "Tue, Thu",
        availableTime: "4:00 PM - 7:00 PM",
        ownerId: "system-Michael",
        ownerEmail: "system@mediqueue.app",
        teachingMode: "Both",
        institution: "MIT",
        location: "Cambridge, MA",
        sessionStartDate: "2026-06-01",
        createdAt: new Date().toISOString()
      },
      {
        id: "t_3",
        name: "Elena Rodriguez",
        photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1976&auto=format&fit=crop",
        subject: "English",
        hourlyFee: 40,
        totalSlot: 15,
        details: "M.A. in English. Focus on Shakespeare and Modern Fiction.",
        experience: "Published author and ESL specialist.",
        availableDays: "Mon - Fri",
        availableTime: "9:00 AM - 12:00 PM",
        ownerId: "system-Elena",
        ownerEmail: "system@mediqueue.app",
        teachingMode: "Offline",
        institution: "Oxford University",
        location: "London, UK",
        sessionStartDate: "2026-06-01",
        createdAt: new Date().toISOString()
      },
      {
        id: "t_4",
        name: "David Kim",
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1974&auto=format&fit=crop",
        subject: "Mathematics",
        hourlyFee: 60,
        totalSlot: 8,
        details: "Expert in Calculus and Statistics. High success rate with students.",
        experience: "7 years of high school tutoring.",
        availableDays: "Sat, Sun",
        availableTime: "1:00 PM - 5:00 PM",
        ownerId: "system-David",
        ownerEmail: "system@mediqueue.app",
        teachingMode: "Online",
        institution: "UC Berkeley",
        location: "Berkeley, CA",
        sessionStartDate: "2026-06-01",
        createdAt: new Date().toISOString()
      },
      {
        id: "t_5",
        name: "Aisha Rahman",
        photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop",
        subject: "Computer Science",
        hourlyFee: 85,
        totalSlot: 12,
        details: "Senior Software Engineer teaching Python, Java, and Web Dev.",
        experience: "12 years in Silicon Valley.",
        availableDays: "Mon, Tue, Wed",
        availableTime: "6:00 PM - 9:00 PM",
        ownerId: "system-Aisha",
        ownerEmail: "system@mediqueue.app",
        teachingMode: "Both",
        institution: "Carnegie Mellon",
        location: "Remote",
        sessionStartDate: "2026-06-01",
        createdAt: new Date().toISOString()
      },
      {
        id: "t_6",
        name: "Prof. James Wilson",
        photo: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=1974&auto=format&fit=crop",
        subject: "History",
        hourlyFee: 45,
        totalSlot: 20,
        details: "Specialist in Modern European History and World Wars.",
        experience: "Author of 3 historical biographies.",
        availableDays: "Fri, Sat",
        availableTime: "11:00 AM - 3:00 PM",
        ownerId: "system-James",
        ownerEmail: "system@mediqueue.app",
        teachingMode: "Both",
        institution: "Yale University",
        location: "New Haven, CT",
        sessionStartDate: "2026-06-01",
        createdAt: new Date().toISOString()
      }
    ];
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
    } catch (e) {
      console.warn("[LocalDB] Error saving local DB:", e.message);
    }
  }

  collection(name) {
    const self = this;
    if (!self.data[name]) {
      self.data[name] = [];
    }

    class CollectionQuery {
      constructor(docs) {
        this.docs = docs;
      }

      where(field, op, value) {
        const filtered = this.docs.filter(doc => {
          if (op === "==") {
            return doc[field] === value;
          }
          return true;
        });
        return new CollectionQuery(filtered);
      }

      limit(n) {
        return new CollectionQuery(this.docs.slice(0, n));
      }

      async get() {
        return {
          empty: this.docs.length === 0,
          size: this.docs.length,
          docs: this.docs.map(doc => ({
            id: doc.id || doc.uid,
            data: () => doc,
            exists: true
          }))
        };
      }

      doc(id) {
        if (!id) {
          id = "doc_" + Math.random().toString(36).substring(2, 11);
        }
        
        const existingIndex = self.data[name].findIndex(item => (item.id === id || item.uid === id));
        let docData = existingIndex !== -1 ? self.data[name][existingIndex] : null;

        return {
          id: id,
          async get() {
            return {
              exists: docData !== null,
              id: id,
              data: () => docData
            };
          },
          async set(payload) {
            const parsed = self.processPayload(payload, docData || {});
            parsed.id = id;
            if (name === "users") {
              parsed.uid = id;
            }

            if (existingIndex !== -1) {
              self.data[name][existingIndex] = { ...self.data[name][existingIndex], ...parsed };
            } else {
              self.data[name].push(parsed);
            }
            self.save();
            docData = parsed;
            return { success: true };
          },
          async update(payload) {
            const targetIndex = self.data[name].findIndex(item => (item.id === id || item.uid === id));
            const baseDoc = targetIndex !== -1 ? self.data[name][targetIndex] : {};
            const parsed = self.processPayload(payload, baseDoc);
            
            if (targetIndex !== -1) {
              self.data[name][targetIndex] = { ...self.data[name][targetIndex], ...parsed };
              self.save();
              docData = self.data[name][targetIndex];
            } else {
              parsed.id = id;
              self.data[name].push(parsed);
              self.save();
              docData = parsed;
            }
            return { success: true };
          },
          async delete() {
            self.data[name] = self.data[name].filter(item => (item.id !== id && item.uid !== id));
            self.save();
            return { success: true };
          }
        };
      }

      async add(payload) {
        const id = "doc_" + Math.random().toString(36).substring(2, 11);
        const parsed = self.processPayload(payload);
        parsed.id = id;
        self.data[name].push(parsed);
        self.save();
        return { id };
      }
    }

    return new CollectionQuery(self.data[name]);
  }

  processPayload(payload, currentDoc = {}) {
    const updated = { ...payload };
    for (const key in updated) {
      const val = updated[key];
      if (val && typeof val === 'object') {
        if (val.constructor && val.constructor.name === 'FieldValue') {
          if (JSON.stringify(val) === '{}') {
            if (key.toLowerCase().includes('time') || key.toLowerCase().includes('at')) {
              updated[key] = new Date().toISOString();
            } else if (key === 'totalSlot') {
              const currentNum = typeof currentDoc[key] === 'number' ? currentDoc[key] : 0;
              updated[key] = Math.max(0, currentNum - 1);
            }
          }
        } else if (val._methodName === 'serverTimestamp') {
          updated[key] = new Date().toISOString();
        } else if (val._methodName === 'increment') {
          const currentNum = typeof currentDoc[key] === 'number' ? currentDoc[key] : 0;
          updated[key] = currentNum + val._val;
        }
      }
    }
    return updated;
  }

  batch() {
    const self = this;
    const ops = [];
    return {
      set(docRef, payload) {
        ops.push({ type: 'set', docRef, payload });
      },
      async commit() {
        for (const op of ops) {
          await op.docRef.set(op.payload);
        }
        self.save();
        return { success: true };
      }
    };
  }
}

function initLocalFallback() {
  console.log("[LocalDB] Initializing file-based persistent database sandbox fallback...");
  db = new MockFirestore();
  FieldValue = MockFieldValue;
  console.log("[LocalDB] Sandbox database fallback loaded successfully from local storage.");
}

/**
 * Seed sample data if collection is empty
 */
async function seedTutors() {
  try {
    const tutorsRef = db.collection("tutors");
    const snapshot = await tutorsRef.limit(5).get();
    
    if (snapshot.size < 3) {
      console.log("[Server] Seeding sample tutors (count low or empty)...");
      const sampleTutors = [
        {
          name: "Dr. Sarah Johnson",
          photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2070&auto=format&fit=crop",
          subject: "Biology",
          hourlyFee: 50,
          totalSlot: 10,
          details: "PhD in Molecular Biology with 10 years of teaching experience.",
          experience: "10+ years in academia and research.",
          availableDays: "Mon, Wed, Fri",
          availableTime: "10:00 AM - 2:00 PM",
          ownerId: "system-Sarah",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Online",
          institution: "Stanford University",
          location: "Palo Alto, CA",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Prof. Michael Chen",
          photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070&auto=format&fit=crop",
          subject: "Physics",
          hourlyFee: 75,
          totalSlot: 5,
          details: "Specialist in Theoretical Physics and Quantum Mechanics.",
          experience: "Lead researcher at CERN for 5 years.",
          availableDays: "Tue, Thu",
          availableTime: "4:00 PM - 7:00 PM",
          ownerId: "system-Michael",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Both",
          institution: "MIT",
          location: "Cambridge, MA",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Elena Rodriguez",
          photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1976&auto=format&fit=crop",
          subject: "English",
          hourlyFee: 40,
          totalSlot: 15,
          details: "M.A. in English. Focus on Shakespeare and Modern Fiction.",
          experience: "Published author and ESL specialist.",
          availableDays: "Mon - Fri",
          availableTime: "9:00 AM - 12:00 PM",
          ownerId: "system-Elena",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Offline",
          institution: "Oxford University",
          location: "London, UK",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "David Kim",
          photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1974&auto=format&fit=crop",
          subject: "Mathematics",
          hourlyFee: 60,
          totalSlot: 8,
          details: "Expert in Calculus and Statistics. High success rate with students.",
          experience: "7 years of high school tutoring.",
          availableDays: "Sat, Sun",
          availableTime: "1:00 PM - 5:00 PM",
          ownerId: "system-David",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Online",
          institution: "UC Berkeley",
          location: "Berkeley, CA",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Aisha Rahman",
          photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop",
          subject: "Computer Science",
          hourlyFee: 85,
          totalSlot: 12,
          details: "Senior Software Engineer teaching Python, Java, and Web Dev.",
          experience: "12 years in Silicon Valley.",
          availableDays: "Mon, Tue, Wed",
          availableTime: "6:00 PM - 9:00 PM",
          ownerId: "system-Aisha",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Both",
          institution: "Carnegie Mellon",
          location: "Remote",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Prof. James Wilson",
          photo: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=1974&auto=format&fit=crop",
          subject: "History",
          hourlyFee: 45,
          totalSlot: 20,
          details: "Specialist in Modern European History and World Wars.",
          experience: "Author of 3 historical biographies.",
          availableDays: "Fri, Sat",
          availableTime: "11:00 AM - 3:00 PM",
          ownerId: "system-James",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Both",
          institution: "Yale University",
          location: "New Haven, CT",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Maria Garcia",
          photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1961&auto=format&fit=crop",
          subject: "Spanish",
          hourlyFee: 35,
          totalSlot: 25,
          details: "Native Spanish speaker. Expert in conversational Spanish and grammar.",
          experience: "15 years of language instruction.",
          availableDays: "Mon - Thu",
          availableTime: "8:00 AM - 10:00 AM",
          ownerId: "system-Maria",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Online",
          institution: "University of Madrid",
          location: "Madrid, Spain",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Alex Turner",
          photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1974&auto=format&fit=crop",
          subject: "Music",
          hourlyFee: 90,
          totalSlot: 6,
          details: "Professional musician teaching Jazz Piano and Music Theory.",
          experience: "Performed at international jazz festivals.",
          availableDays: "Tue, Thu, Sat",
          availableTime: "2:00 PM - 6:00 PM",
          ownerId: "system-Alex",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Offline",
          institution: "Juilliard School",
          location: "New York, NY",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          name: "Dr. Emily Wong",
          photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=1974&auto=format&fit=crop",
          subject: "Chemistry",
          hourlyFee: 55,
          totalSlot: 15,
          details: "Expert in Organic Chemistry and Biochemistry.",
          experience: "Postdoctoral fellow at Max Planck Institute.",
          availableDays: "Wed, Sun",
          availableTime: "4:00 PM - 8:00 PM",
          ownerId: "system-Emily",
          ownerEmail: "system@mediqueue.app",
          teachingMode: "Both",
          institution: "HKUST",
          location: "Hong Kong",
          sessionStartDate: "2026-06-01",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ];

      const batch = db.batch();
      sampleTutors.forEach(tutor => {
        const docRef = tutorsRef.doc();
        batch.set(docRef, tutor);
      });
      await batch.commit();
      console.log("[Server] Seeding complete.");
    }
  } catch (err) {
    console.warn("[Server] Seed failed (often due to missing permissions):", err.message);
  }
}

/**
 * Initialize Database
 */
async function initDb() {
  if (!adminApp) {
    console.error("[Server] Cannot initialize Firestore: Firebase Admin App is missing.");
    initLocalFallback();
    return;
  }

  const databaseId = firebaseConfig.firestoreDatabaseId;
  const useDefaultDb = !databaseId || databaseId === "(default)";
  const dbConfig = useDefaultDb ? undefined : databaseId;
  
  let success = false;

  try {
    console.log(`[Server] Connecting to Firestore - Project: ${firebaseConfig.projectId}, DB: ${databaseId || '(default)'}...`);
    
    // Use the explicit app and database ID
    db = getFirestore(adminApp, dbConfig);
    
    // Quick validation query to verify connectivity
    const snap = await db.collection("tutors").limit(1).get();
    console.log(`[Server] Firestore connection successful. Documents found: ${snap.size}`);
    
    // Run seeding
    await seedTutors();
    success = true;
  } catch (e) {
    console.warn(`[Server] Firestore connection error for database '${databaseId}': ${e.message}`);
    
    // If we failed with a custom ID, try falling back to the default database
    if (!useDefaultDb) {
      try {
        console.log("[Server] Falling back to (default) database...");
        const fallbackDb = getFirestore(adminApp);
        await fallbackDb.collection("tutors").limit(1).get();
        db = fallbackDb;
        console.log("[Server] Fallback to (default) successful.");
        await seedTutors();
        success = true;
      } catch (fallbackErr) {
        console.warn("[Server] Fallback to (default) also failed:", fallbackErr.message);
      }
    }
    
    if (!success) {
      // Final desperate attempt: implicit initialization (no app pointer)
      try {
         console.log("[Server] Final attempt: using implicit getFirestore()...");
         const implicitDb = getFirestore();
         await implicitDb.collection("tutors").limit(1).get();
         db = implicitDb;
         console.log("[Server] Implicit connection successful.");
         await seedTutors();
         success = true;
      } catch (finalErr) {
         console.error("[Server] CRITICAL: All Firestore connection attempts failed.");
      }
    }
  }

  if (!success) {
    initLocalFallback();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("[Server] Initializing database...");
  await initDb();

  // Auto-remove "Marium Binte Muhammad" tutor profile from the active database if present
  try {
    const tutorsRef = db.collection("tutors");
    const snapshot = await tutorsRef.where("name", "==", "Marium Binte Muhammad").get();
    if (!snapshot.empty) {
      console.log(`[Server] Found ${snapshot.size} tutor(s) with name 'Marium Binte Muhammad'. Deleting on startup...`);
      for (const doc of snapshot.docs) {
        await tutorsRef.doc(doc.id).delete();
      }
      console.log("[Server] Cleanup of 'Marium Binte Muhammad' tutor profile completed.");
    }
  } catch (err) {
    console.warn("[Server] Automatic clean up of Marium Binte Muhammad tutor failed:", err.message);
  }

  app.use(express.json());
  app.use(cookieParser());

  // Middleware to ensure DB is initialized
  app.use((req, res, next) => {
    if (!db) {
      return res.status(503).json({ 
        message: "Database not initialized. Please wait or check server logs.",
        status: "initializing"
      });
    }
    next();
  });

  // Health check
  app.get("/api/health", async (req, res) => {
    const results = {};
    try {
      console.log("[Health] Checking current db instance...");
      if (!db) throw new Error("Database instance not initialized");
      const snap = await db.collection("tutors").limit(1).get();
      results.current = { status: "ok", docs: snap.size };
    } catch (err) {
      results.current = { status: "error", message: err.message, code: err.code };
    }

    try {
      console.log("[Health] Checking default database explicitly...");
      const dbDefault = getFirestore(adminApp);
      const snapDefault = await dbDefault.collection("tutors").limit(1).get();
      results.default = { status: "ok", docs: snapDefault.size };
    } catch (err) {
      results.default = { status: "error", message: err.message, code: err.code };
    }

    res.json({
      status: results.current && results.current.status === "ok" ? "ok" : "error",
      results,
      activeApp: {
        projectId: adminApp.options.projectId,
        name: adminApp.name
      },
      config: {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId
      }
    });
  });

  // Middleware to verify JWT
  const verifyToken = (req, res, next) => {
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) return res.status(401).send({ message: 'Unauthorized' });
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).send({ message: 'Forbidden' });
      req.user = decoded;
      next();
    });
  };

  // JWT Issue Endpoint
  app.post("/api/jwt", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '10h' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    }).send({ success: true, token });
  });

  // JWT Logout/Clear
  app.post("/api/logout", (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    }).send({ success: true });
  });

  // --- Custom Password Auth Fallback Endpoints ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, photoURL } = req.body;
      if (!email || !password || !name) {
        return res.status(400).send({ message: "Email, password, and name are required." });
      }

      // Check if user already exists
      const query = await db.collection("users").where("email", "==", email).get();
      if (!query.empty) {
        return res.status(400).send({ message: "An account with this email already exists." });
      }

      const uid = "h_uid_" + Math.random().toString(36).substring(2, 11);
      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

      const userRef = db.collection("users").doc(uid);
      await userRef.set({
        uid,
        email,
        name,
        photoURL: photoURL || "",
        passwordHash,
        createdAt: FieldValue.serverTimestamp()
      });

      const token = jwt.sign({ email, uid }, JWT_SECRET, { expiresIn: '10h' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }).send({ 
        success: true, 
        token, 
        user: { uid, email, displayName: name, photoURL } 
      });
    } catch (e) {
      console.error("Custom Register Error:", e);
      res.status(500).send({ message: "Failed to create user: " + e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).send({ message: "Email and password are required." });
      }

      const query = await db.collection("users").where("email", "==", email).get();
      if (query.empty) {
        return res.status(404).send({ message: "No account found with this email." });
      }

      const userDoc = query.docs[0];
      const userData = userDoc.data();

      // If user exists but was created via OAuth/Google with no passwordHash
      if (!userData.passwordHash) {
        return res.status(400).send({ 
          message: "This account was registered without a password (e.g., via Google). Please log in using Google." 
        });
      }

      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

      if (userData.passwordHash !== passwordHash) {
        return res.status(401).send({ message: "Incorrect password." });
      }

      const uid = userData.uid || userDoc.id;
      const token = jwt.sign({ email, uid }, JWT_SECRET, { expiresIn: '10h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }).send({ 
        success: true, 
        token, 
        user: { 
          uid, 
          email, 
          displayName: userData.name || userData.displayName || "User", 
          photoURL: userData.photoURL || "" 
        } 
      });
    } catch (e) {
      console.error("Custom Login Error:", e);
      res.status(500).send({ message: "Login failed: " + e.message });
    }
  });

  // --- User API ---
  app.post("/api/users", verifyToken, async (req, res) => {
    try {
      const { uid, name, email, photoURL } = req.body;
      if (req.user.email !== email) return res.status(403).send({ message: "Email mismatch" });

      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await userRef.set({
          uid,
          name: name || 'Anonymous',
          email,
          photoURL: photoURL || '',
          createdAt: FieldValue.serverTimestamp()
        });
      } else {
        const updateData = {};
        if (name && name !== 'Anonymous') {
          updateData.name = name;
        }
        if (photoURL) {
          updateData.photoURL = photoURL;
        }
        if (Object.keys(updateData).length > 0) {
          await userRef.update(updateData);
        }
      }
      res.send({ success: true });
    } catch (error) {
      console.error("User Creation Error:", error);
      res.status(500).send({ message: "Failed to sync user profile" });
    }
  });

  app.get("/api/users/profile", verifyToken, async (req, res) => {
    try {
      const email = req.user.email;
      console.log(`[Profile] Fetching for email: ${email}`);
      const snapshot = await db.collection("users").where("email", "==", email).get();
      if (snapshot.empty) {
        console.log(`[Profile] Not found for email: ${email}`);
        return res.status(404).send({ message: "Profile not found" });
      }
      const userDoc = snapshot.docs[0];
      console.log(`[Profile] Found for email: ${email}`);
      res.send({ ...userDoc.data(), id: userDoc.id });
    } catch (error) {
      console.error("[Profile] Fetch Error:", error);
      res.status(500).send({ 
        message: "Failed to fetch profile", 
        error: error.message,
        code: error.code
      });
    }
  });

  // --- Tutor API Endpoints ---
  // Get all tutors with search and filters
  app.get("/api/tutors", async (req, res) => {
    try {
      const { search, limit, email, startDate, endDate, category } = req.query;
      let q = db.collection("tutors");
      
      // Firestore indexing where possible
      if (category && category !== 'All') {
        q = q.where("subject", "==", category);
      }
      
      if (email) {
        q = q.where("ownerEmail", "==", email);
      }

      if (limit) {
        q = q.limit(parseInt(limit));
      }

      const snapshot = await q.get();
      
      let results = snapshot.docs.map(doc => ({
        ...doc.data(),
        _id: doc.id,
        id: doc.id
      }));

      // In-memory case-insensitive search (Regex simulation)
      if (search) {
        const regex = new RegExp(search, 'i');
        results = results.filter(t => regex.test(t.name || ''));
      }

      // Filter by sessionStartDate date ranges (simulation of $gte and $lte)
      if (startDate) {
        results = results.filter(t => t.sessionStartDate && t.sessionStartDate >= startDate);
      }
      if (endDate) {
        results = results.filter(t => t.sessionStartDate && t.sessionStartDate <= endDate);
      }

      if (limit) {
        results = results.slice(0, parseInt(limit));
      }

      res.send(results);
    } catch (error) {
      console.error("Firestore Error:", error);
      res.status(500).send({ message: "Failed to fetch tutors", error: error.message });
    }
  });

  // Get single tutor
  app.get("/api/tutors/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const tutorDoc = await db.collection("tutors").doc(id).get();
      if (!tutorDoc.exists) {
        return res.status(404).send({ message: "Tutor not found" });
      }
      res.send({ ...tutorDoc.data(), _id: tutorDoc.id, id: tutorDoc.id });
    } catch (error) {
      res.status(500).send({ message: "Error fetching tutor details" });
    }
  });

  // Create tutor (Private)
  app.post("/api/tutors", verifyToken, async (req, res) => {
    try {
      const tutor = req.body;
      const docRef = await db.collection("tutors").add({
        ...tutor,
        createdAt: FieldValue.serverTimestamp()
      });
      res.send({ insertedId: docRef.id });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Failed to add tutor" });
    }
  });

  // Bulk add tutors (Private)
  app.post("/api/tutors/bulk", verifyToken, async (req, res) => {
    try {
      const tutors = req.body;
      if (!Array.isArray(tutors)) return res.status(400).send({ message: "Must be an array" });
      
      const batch = db.batch();
      tutors.forEach(tutor => {
        const docRef = db.collection("tutors").doc();
        batch.set(docRef, {
          ...tutor,
          createdAt: FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      res.send({ success: true, count: tutors.length });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Bulk insert failed" });
    }
  });

  // Update tutor (Private)
  app.put("/api/tutors/:id", verifyToken, async (req, res) => {
    try {
      const id = req.params.id;
      const updatedTutor = req.body;
      const email = req.user.email;

      const tutorDoc = await db.collection("tutors").doc(id).get();
      if (!tutorDoc.exists) return res.status(404).send({ message: "Tutor not found" });
      if (tutorDoc.data().ownerEmail !== email) return res.status(403).send({ message: "Unauthorized" });

      delete updatedTutor._id;
      delete updatedTutor.id;
      
      await db.collection("tutors").doc(id).update(updatedTutor);
      res.send({ success: true });
    } catch (error) {
      res.status(500).send({ message: "Failed to update tutor" });
    }
  });

  // Delete tutor (Private)
  app.delete("/api/tutors/:id", verifyToken, async (req, res) => {
    try {
      const id = req.params.id;
      const email = req.user.email;

      const tutorDoc = await db.collection("tutors").doc(id).get();
      if (!tutorDoc.exists) return res.status(404).send({ message: "Tutor not found" });
      if (tutorDoc.data().ownerEmail !== email) return res.status(403).send({ message: "Unauthorized" });

      await db.collection("tutors").doc(id).delete();
      res.send({ success: true });
    } catch (error) {
      res.status(500).send({ message: "Failed to delete tutor" });
    }
  });

  // --- Booking API Endpoints ---

  // Get user's booked sessions
  app.get("/api/bookings", verifyToken, async (req, res) => {
    try {
      const email = req.user.email;
      const snapshot = await db.collection("bookings").where("studentEmail", "==", email).get();
      const results = snapshot.docs.map(doc => ({ ...doc.data(), _id: doc.id, id: doc.id }));
      res.send(results);
    } catch (error) {
      res.status(500).send({ message: "Failed to fetch bookings" });
    }
  });

  // Create booking (Private)
  app.post("/api/bookings", verifyToken, async (req, res) => {
    try {
      const booking = req.body;
      
      const tutorRef = db.collection("tutors").doc(booking.tutorId);
      const tutorDoc = await tutorRef.get();
      
      if (!tutorDoc.exists || (tutorDoc.data().totalSlot || 0) <= 0) {
        return res.status(400).send({ message: "No slots available" });
      }

      // Update slot count
      await tutorRef.update({
        totalSlot: FieldValue.increment(-1)
      });

      const docRef = await db.collection("bookings").add({
        ...booking,
        createdAt: FieldValue.serverTimestamp()
      });
      
      res.send({ insertedId: docRef.id });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Booking failed" });
    }
  });

  // Update booking status (Cancel)
  app.patch("/api/bookings/:id", verifyToken, async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      await db.collection("bookings").doc(id).update({ status });
      res.send({ success: true });
    } catch (error) {
      res.status(500).send({ message: "Failed to cancel booking" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
