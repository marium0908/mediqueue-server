// Client-Side Mock Database Interceptor Layer for Serverless Deployments (Vercel)
// This file intercepts all `/api/*` fetch requests and serves them from a highly resilient local localStorage database.
// This allows the application to run serverless with 100% features (registration, logins, booking, cancel, filters)
// out-of-the-box on Vercel or locally, while preserving the real MongoDB Atlas Express architecture in the codebase.

const SEED_TUTORS = [
  {
    _id: "tutor_01",
    name: "Dr. Sarah Jenkins",
    photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400",
    subject: "Mathematics",
    availableDays: "Mon - Wed",
    availableTime: "4:00 PM - 7:00 PM",
    hourlyFee: 45,
    totalSlots: 5,
    sessionStartDate: "2026-06-01",
    institution: "MIT",
    experience: "8 years",
    location: "Boston",
    teachingMode: "Online",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  },
  {
    _id: "tutor_02",
    name: "Prof. Michael Chen",
    photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400",
    subject: "Physics",
    availableDays: "Tue - Thu",
    availableTime: "5:00 PM - 8:00 PM",
    hourlyFee: 50,
    totalSlots: 4,
    sessionStartDate: "2026-06-05",
    institution: "Stanford University",
    experience: "12 years",
    location: "San Francisco",
    teachingMode: "Both",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  },
  {
    _id: "tutor_03",
    name: "Emily Rodriguez",
    photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400",
    subject: "Chemistry",
    availableDays: "Sun - Tue",
    availableTime: "3:00 PM - 6:00 PM",
    hourlyFee: 40,
    totalSlots: 3,
    sessionStartDate: "2026-05-25",
    institution: "UC Berkeley",
    experience: "5 years",
    location: "Berkeley",
    teachingMode: "Online",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  },
  {
    _id: "tutor_04",
    name: "Dr. David Kim",
    photoUrl: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
    subject: "Biology",
    availableDays: "Wed - Fri",
    availableTime: "5:00 PM - 8:00 PM",
    hourlyFee: 45,
    totalSlots: 0,
    sessionStartDate: "2026-06-10",
    institution: "Harvard University",
    experience: "10 years",
    location: "Cambridge",
    teachingMode: "Offline",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  },
  {
    _id: "tutor_05",
    name: "James Wilson",
    photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
    subject: "Computer Science",
    availableDays: "Mon - Thu",
    availableTime: "6:00 PM - 9:00 PM",
    hourlyFee: 55,
    totalSlots: 8,
    sessionStartDate: "2026-05-20",
    institution: "Georgia Tech",
    experience: "6 years",
    location: "Atlanta",
    teachingMode: "Both",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  },
  {
    _id: "tutor_06",
    name: "Sophia Martinez",
    photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
    subject: "English",
    availableDays: "Sat - Sun",
    availableTime: "10:00 AM - 1:00 PM",
    hourlyFee: 35,
    totalSlots: 6,
    sessionStartDate: "2026-06-12",
    institution: "Columbia University",
    experience: "4 years",
    location: "New York",
    teachingMode: "Online",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  },
  {
    _id: "tutor_07",
    name: "Alexander Wright",
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
    subject: "Other",
    availableDays: "Mon - Wed",
    availableTime: "5:00 PM - 8:00 PM",
    hourlyFee: 48,
    totalSlots: 2,
    sessionStartDate: "2026-06-03",
    institution: "Oxford University",
    experience: "7 years",
    location: "London",
    teachingMode: "Both",
    createdByUserEmail: "admin@mediqueue.org",
    createdByUserName: "Admin Director"
  }
];

// Helper functions for getting and setting localStorage database tables
function getStorage(key, defaultVal = []) {
  const item = localStorage.getItem(key);
  if (!item) {
    localStorage.setItem(key, JSON.stringify(defaultVal));
    return defaultVal;
  }
  try {
    return JSON.parse(item);
  } catch (e) {
    return defaultVal;
  }
}

function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// Ensure database state is fully bootstrapped
getStorage("mock_tutors", SEED_TUTORS);
getStorage("mock_users", []);
getStorage("mock_bookings", []);

// Intercept window.fetch!
const originalFetch = window.fetch;

const customFetch = async function (input, init = {}) {
  let url = typeof input === "string" ? input : input.url;
  
  // If not an API request, pass through to the original fetch immediately
  if (!url.startsWith("/api/")) {
    return originalFetch.apply(this, arguments);
  }

  // Helper mock Response creators
  const mockResponse = (body, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  const mockError = (message, status = 400) => {
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  const getLoggedInUser = () => {
    const authHeader = init.headers && (init.headers["Authorization"] || init.headers["authorization"]);
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return null;
    
    // Simulate JWT token decoding / parsing
    try {
      if (token.startsWith("mock_token_")) {
        const decoded = JSON.parse(atob(token.substring(11)));
        return decoded;
      }
    } catch (e) {
      // ignore
    }

    // Standard fallback session user if any
    const sessionTokenUserStr = localStorage.getItem("mock_session_user");
    if (sessionTokenUserStr) {
      try {
        return JSON.parse(sessionTokenUserStr);
      } catch (e) {}
    }
    return null;
  };

  const method = (init.method || "GET").toUpperCase();
  const urlObj = new URL(url, window.location.origin);
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  console.log(`[API MOCK INTERCEPTOR] ${method} ${pathname}`, init);

  try {
    // 1. GET /api/db-status
    if (pathname === "/api/db-status" && method === "GET") {
      return mockResponse({
        status: "connected",
        database: "MongoDB Atlas (Simulated)",
        uriSanitized: "mongodb+srv://****:****@portfolio_cluster.mongodb.net/?appName=TutorBook",
        error: null
      });
    }

    // 2. POST /api/auth/register
    if (pathname === "/api/auth/register" && method === "POST") {
      const body = JSON.parse(init.body || "{}");
      const { name, email, password, photoUrl } = body;
      
      if (!name || !email || !password) {
        return mockError("Please provide all required fields");
      }

      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const isValidLength = password.length >= 6;

      if (!hasUpper || !hasLower || !isValidLength) {
        return mockError("Password does not meet safety criteria (must be >= 6 chars, have uppercase and lowercase)");
      }

      const users = getStorage("mock_users");
      const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return mockError("An account is already registered with this email");
      }

      const newUser = {
        _id: "user_" + Date.now(),
        name,
        email,
        passwordHash: password,
        photoUrl: photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      setStorage("mock_users", users);

      return mockResponse({ message: "Registration successful! You can log in now." }, 201);
    }

    // 3. POST /api/auth/login
    if (pathname === "/api/auth/login" && method === "POST") {
      const body = JSON.parse(init.body || "{}");
      const { email, password } = body;

      if (!email || !password) {
        return mockError("Please enter both email and password");
      }

      const users = getStorage("mock_users");
      const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);

      if (!matched) {
        return mockError("Invalid email or password combination", 401);
      }

      const payload = {
        email: matched.email,
        name: matched.name,
        photoUrl: matched.photoUrl
      };

      // Create a simulated JWT
      const token = "mock_token_" + btoa(JSON.stringify(payload));
      localStorage.setItem("mock_session_user", JSON.stringify(payload));

      return mockResponse({ token, user: payload });
    }

    // 4. POST /api/auth/google
    if (pathname === "/api/auth/google" && method === "POST") {
      const body = JSON.parse(init.body || "{}");
      const { name, email, photoUrl } = body;

      if (!email) {
        return mockError("Google Authentication failed: no email returned");
      }

      const cleanName = name || email.split("@")[0];
      const cleanPhoto = photoUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150";

      const users = getStorage("mock_users");
      let matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!matched) {
        matched = {
          _id: "google_" + Date.now(),
          name: cleanName,
          email,
          passwordHash: "social_google_login",
          photoUrl: cleanPhoto,
          createdAt: new Date().toISOString()
        };
        users.push(matched);
        setStorage("mock_users", users);
      }

      const payload = {
        email: matched.email,
        name: matched.name,
        photoUrl: matched.photoUrl
      };

      const token = "mock_token_" + btoa(JSON.stringify(payload));
      localStorage.setItem("mock_session_user", JSON.stringify(payload));

      return mockResponse({ token, user: payload });
    }

    // 5. GET /api/tutors
    if (pathname === "/api/tutors" && method === "GET") {
      const search = searchParams.get("search");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const limit = searchParams.get("limit");

      let list = getStorage("mock_tutors", SEED_TUTORS);

      if (search) {
        const query = search.toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(query) || t.subject.toLowerCase().includes(query));
      }

      if (startDate) {
        list = list.filter(t => t.sessionStartDate >= startDate);
      }

      if (endDate) {
        list = list.filter(t => t.sessionStartDate <= endDate);
      }

      if (limit) {
        list = list.slice(0, parseInt(limit, 10));
      }

      return mockResponse(list);
    }

    // 6. GET /api/tutors/:id
    if (pathname.startsWith("/api/tutors/") && method === "GET") {
      const id = pathname.substring(12); // length of "/api/tutors/" is 12
      const list = getStorage("mock_tutors", SEED_TUTORS);
      const tutor = list.find(t => t._id === id);

      if (!tutor) {
        return mockError("Tutor not found", 404);
      }

      return mockResponse(tutor);
    }

    // 7. POST /api/tutors
    if (pathname === "/api/tutors" && method === "POST") {
      const currentUser = getLoggedInUser();
      if (!currentUser) {
        return mockError("No authorization token provided", 401);
      }

      const body = JSON.parse(init.body || "{}");
      const {
        name,
        photoUrl,
        subject,
        availableDays,
        availableTime,
        hourlyFee,
        totalSlots,
        sessionStartDate,
        institution,
        experience,
        location,
        teachingMode
      } = body;

      if (!name || !subject || !availableDays || !availableTime || hourlyFee === undefined || totalSlots === undefined || !sessionStartDate) {
        return mockError("Please fill in all mandatory tutor fields");
      }

      const tutors = getStorage("mock_tutors");
      const newTutor = {
        _id: "tutor_" + Date.now(),
        name,
        photoUrl: photoUrl || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400",
        subject,
        availableDays,
        availableTime,
        hourlyFee: Number(hourlyFee),
        totalSlots: Number(totalSlots),
        sessionStartDate,
        institution: institution || "Self-Employed",
        experience: experience || "1 year",
        location: location || "In-Person",
        teachingMode: teachingMode || "Online",
        createdByUserEmail: currentUser.email,
        createdByUserName: currentUser.name
      };

      tutors.push(newTutor);
      setStorage("mock_tutors", tutors);

      return mockResponse({
        message: "Tutor registration saved successfully!",
        tutor: newTutor
      }, 201);
    }

    // 8. PATCH /api/tutors/:id
    if (pathname.startsWith("/api/tutors/") && method === "PATCH") {
      const currentUser = getLoggedInUser();
      if (!currentUser) {
        return mockError("No authorization token provided", 401);
      }

      const id = pathname.substring(12);
      const tutors = getStorage("mock_tutors");
      const idx = tutors.findIndex(t => t._id === id);

      if (idx === -1) {
        return mockError("Tutor entry not found", 404);
      }

      const tutor = tutors[idx];
      if (tutor.createdByUserEmail !== currentUser.email) {
        return mockError("You are not authorized to edit this tutor entry", 403);
      }

      const body = JSON.parse(init.body || "{}");
      delete body._id;
      if (body.hourlyFee !== undefined) body.hourlyFee = Number(body.hourlyFee);
      if (body.totalSlots !== undefined) body.totalSlots = Number(body.totalSlots);

      tutors[idx] = {
        ...tutor,
        ...body
      };

      setStorage("mock_tutors", tutors);

      return mockResponse({
        message: "Tutor updated successfully!",
        tutor: tutors[idx]
      });
    }

    // 9. DELETE /api/tutors/:id
    if (pathname.startsWith("/api/tutors/") && method === "DELETE") {
      const currentUser = getLoggedInUser();
      if (!currentUser) {
        return mockError("No authorization token provided", 401);
      }

      const id = pathname.substring(12);
      const tutors = getStorage("mock_tutors");
      const idx = tutors.findIndex(t => t._id === id);

      if (idx === -1) {
        return mockError("Tutor entry not found", 404);
      }

      const tutor = tutors[idx];
      if (tutor.createdByUserEmail !== currentUser.email) {
        return mockError("You are not authorized to delete this tutor entry", 403);
      }

      tutors.splice(idx, 1);
      setStorage("mock_tutors", tutors);

      return mockResponse({ message: "Tutor entry deleted successfully!" });
    }

    // 10. POST /api/bookings
    if (pathname === "/api/bookings" && method === "POST") {
      const currentUser = getLoggedInUser();
      if (!currentUser) {
        return mockError("No authorization token provided", 401);
      }

      const body = JSON.parse(init.body || "{}");
      const { tutorId, studentName, studentPhone, virtualDate } = body;

      if (!tutorId || !studentName || !studentPhone) {
        return mockError("Please enter your name and phone number to complete booking");
      }

      const tutors = getStorage("mock_tutors");
      const tutorIdx = tutors.findIndex(t => t._id === tutorId);

      if (tutorIdx === -1) {
        return mockError("The specified tutor was not found", 404);
      }

      const tutor = tutors[tutorIdx];

      // Retrieve virtual date
      const clientVirtualDate = virtualDate || "2026-05-21";
      const currentDateString = clientVirtualDate;

      if (currentDateString < tutor.sessionStartDate) {
        return mockError("Booking is not available yet for this tutor");
      }

      if (tutor.totalSlots <= 0) {
        return mockError("No available slots left");
      }

      // Decrement slot
      tutors[tutorIdx].totalSlots -= 1;
      setStorage("mock_tutors", tutors);

      const bookings = getStorage("mock_bookings");
      const newBooking = {
        _id: "book_" + Date.now(),
        tutorId: tutor._id,
        tutorName: tutor.name,
        studentName,
        studentPhone,
        studentEmail: currentUser.email,
        bookingStatus: "booked",
        bookedAt: new Date().toISOString()
      };

      bookings.push(newBooking);
      setStorage("mock_bookings", bookings);

      return mockResponse({
        message: "Your learning slot has been successfully booked!",
        booking: newBooking
      }, 201);
    }

    // 11. GET /api/bookings/my
    if (pathname === "/api/bookings/my" && method === "GET") {
      const currentUser = getLoggedInUser();
      if (!currentUser) {
        return mockError("No authorization token provided", 401);
      }

      const bookings = getStorage("mock_bookings");
      const myBooks = bookings.filter(b => b.studentEmail === currentUser.email);

      return mockResponse(myBooks);
    }

    // 12. PATCH /api/bookings/:id/cancel
    if (pathname.startsWith("/api/bookings/") && pathname.endsWith("/cancel") && method === "PATCH") {
      const currentUser = getLoggedInUser();
      if (!currentUser) {
        return mockError("No authorization token provided", 401);
      }

      const idParts = pathname.split("/");
      const bookingId = idParts[3];

      const bookings = getStorage("mock_bookings");
      const bIdx = bookings.findIndex(b => b._id === bookingId);

      if (bIdx === -1) {
        return mockError("Booking record not found", 404);
      }

      if (bookings[bIdx].studentEmail !== currentUser.email) {
        return mockError("Unauthorized request", 403);
      }

      bookings[bIdx].bookingStatus = "cancelled";
      setStorage("mock_bookings", bookings);

      // Increment slot back
      const tutors = getStorage("mock_tutors");
      const tIdx = tutors.findIndex(t => t._id === bookings[bIdx].tutorId);
      if (tIdx !== -1) {
        tutors[tIdx].totalSlots += 1;
        setStorage("mock_tutors", tutors);
      }

      return mockResponse({ message: "Booking cancelled successfully" });
    }

    // Default fallback to server
    return originalFetch.apply(this, arguments);

  } catch (err) {
    console.error("[API MOCK INTERCEPTOR ERROR]", err);
    return mockError("Simulation Error: " + err.message, 500);
  }
};

try {
  Object.defineProperty(window, "fetch", {
    value: customFetch,
    writable: true,
    configurable: true
  });
} catch (e) {
  try {
    window.fetch = customFetch;
  } catch (err2) {
    console.error("Failed to intercept window.fetch", err2);
  }
}

console.log("🚀 [TUTOR BOOKING] Client-Side MongoDB Atlas Simulated Storage Layer Activated Successfully");
