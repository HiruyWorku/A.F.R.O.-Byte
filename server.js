const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/afrobyte', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    progress: {
        completedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
        currentCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
        quizScores: [{
            courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
            score: Number,
            date: Date
        }]
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Course Schema
const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: [{
        type: { type: String, enum: ['video', 'text', 'quiz'] },
        title: String,
        content: String,
        duration: Number
    }],
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    category: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);

// Authentication Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id });
        
        if (!user) {
            throw new Error();
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

// Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).send({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await user.save();
        
        // Generate token
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
        
        res.status(201).send({ user, token });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).send({ error: 'Invalid credentials' });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).send({ error: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
        
        res.send({ user, token });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// Course Routes
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find();
        res.send(courses);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).send({ error: 'Course not found' });
        }
        res.send(course);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Progress Routes
app.post('/api/progress', auth, async (req, res) => {
    try {
        const { courseId, score } = req.body;
        
        const user = req.user;
        user.progress.quizScores.push({
            courseId,
            score,
            date: new Date()
        });
        
        await user.save();
        res.send(user.progress);
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// Chat Schema
const chatSchema = new mongoose.Schema({
    message: String,
    response: String,
    timestamp: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);

// Socket.IO Connection
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('chat message', async (message) => {
        try {
            // Call Hugging Face API
            const response = await axios.post(
                'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
                { inputs: message },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const botResponse = response.data.generated_text;

            // Save to database
            const chat = new Chat({
                message: message,
                response: botResponse
            });
            await chat.save();

            // Send response back to client
            socket.emit('chat response', botResponse);
        } catch (error) {
            console.error('Error:', error);
            socket.emit('chat response', 'Sorry, I encountered an error. Please try again.');
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Routes
app.get('/api/chats', async (req, res) => {
    try {
        const chats = await Chat.find().sort({ timestamp: -1 }).limit(50);
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching chat history' });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 