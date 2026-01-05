const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// Database configuration
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "school_db",
  password: "1234",
  port: 5432
});

// Input validation middleware
const validateStudentInput = (req, res, next) => {
  const { student_name, student_class, section, gender } = req.body;
  if (!student_name?.trim()) return res.status(400).json({ error: "Student name is required" });
  if (!student_class?.trim()) return res.status(400).json({ error: "Class is required" });
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
};

app.use(errorHandler);

/* TEST */
app.get("/test", (req, res) => {
  res.send("Backend working");
});

/* GET ALL */
app.get("/students", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.student_id,
        s.student_name,
        s.student_class,
        s.section,
        s.gender,
        m.tamil,
        m.english,
        m.maths,
        m.science,
        m.social_science
      FROM student s
      JOIN marks m ON s.student_id = m.student_id
      ORDER BY s.student_id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Fetch error");
  }
});

/* SAVE */
app.post("/students", async (req, res) => {
  try {
    const {
      student_name,
      student_class,
      section,
      gender,
      tamil,
      english,
      maths,
      science,
      social_science
    } = req.body;

    if (!student_name || student_name.trim() === "") {
      return res.status(400).send("Name required");
    }

    const student = await pool.query(
      `INSERT INTO student (student_name, student_class, section, gender)
       VALUES ($1,$2,$3,$4)
       RETURNING student_id`,
      [student_name, student_class, section, gender]
    );

    await pool.query(
      `INSERT INTO marks
       (student_id, tamil, english, maths, science, social_science)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        student.rows[0].student_id,
        tamil,
        english,
        maths,
        science,
        social_science
      ]
    );

    res.send("Saved");
  } catch (err) {
    console.error(err);
    res.status(500).send("Save error");
  }
});

// ====================
// ATTENDANCE ENDPOINTS
// ====================

// Save attendance
app.post('/attendance', async (req, res) => {
  try {
    const { student_id, date, status } = req.body;
    
    if (!student_id || !date || !['Present', 'Absent'].includes(status)) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Check if student exists
    const studentCheck = await pool.query(
      'SELECT 1 FROM student WHERE student_id = $1',
      [student_id]
    );
    
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Insert or update attendance
    const result = await pool.query(
      `INSERT INTO attendance (student_id, date, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id, date) 
       DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [student_id, date, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving attendance:', err);
    res.status(500).json({ error: 'Error saving attendance' });
  }
});

// Get attendance records with optional filters
app.get('/attendance', async (req, res) => {
  try {
    const { student_id, start_date, end_date } = req.query;
    let query = `
      SELECT a.*, s.student_name 
      FROM attendance a
      JOIN student s ON a.student_id = s.student_id
    `;
    const queryParams = [];
    const conditions = [];
    
    if (student_id) {
      queryParams.push(student_id);
      conditions.push(`a.student_id = $${queryParams.length}`);
    }
    
    if (start_date) {
      queryParams.push(start_date);
      conditions.push(`a.date >= $${queryParams.length}`);
    }
    
    if (end_date) {
      queryParams.push(end_date);
      conditions.push(`a.date <= $${queryParams.length}`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY a.date DESC, s.student_name';
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Error fetching attendance records' });
  }
});

// ====================
// EXAM SCHEDULE ENDPOINTS
// ====================

// Save exam schedule
app.post('/exams', async (req, res) => {
  try {
    const { exam_name, subject, exam_date, exam_time } = req.body;
    
    if (!exam_name?.trim() || !subject?.trim() || !exam_date || !exam_time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await pool.query(
      `INSERT INTO exam_schedule (exam_name, subject, exam_date, exam_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [exam_name, subject, exam_date, exam_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving exam schedule:', err);
    res.status(500).json({ error: 'Error saving exam schedule' });
  }
});

// Get exam schedule
app.get('/exams', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = 'SELECT * FROM exam_schedule';
    const queryParams = [];
    const conditions = [];
    
    if (start_date) {
      queryParams.push(start_date);
      conditions.push(`exam_date >= $${queryParams.length}`);
    }
    
    if (end_date) {
      queryParams.push(end_date);
      conditions.push(`exam_date <= $${queryParams.length}`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY exam_date, exam_time';
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exam schedule:', err);
    res.status(500).json({ error: 'Error fetching exam schedule' });
  }
});


/// extra codeyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



