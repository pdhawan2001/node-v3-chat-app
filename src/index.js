const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersnRoom, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)  //Socketio expects to be called with raw HTTP server

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {  //socket is an object and it contains information about new connection
    console.log('New Websocket connection')

    socket.on('join', (options, callback) => {
        // Validate/track user
        const { error, user } = addUser({ id: socket.id, ...options })
        
        // If error, send message back to client
        if (error) {
            return callback(error) 
        }   

        // Else, join the room
        socket.join(user.room)

        // Welcome the user to the room
        socket.emit('message', generateMessage('Admin', 'Welcome!'))

        // Broadcast an event to everyone in the room
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined`))

        // After a user joins or leaves
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
     })

    socket.on('sendMessage', (message, callback) => {

        // Get the username and room for the user
        const user = getUser(socket.id)
        const filter = new Filter()
        
        if(filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        } 

        // Emit the message to just that room
        io.to(user.room).emit('message', generateMessage(user.username, message))

        // Send an acknowledgement to the client
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {

        // Get the username and room for the user
        const user = getUser(socket.id)

        // Emit the message to just that room
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))

        // Send an acknowledgement to the client
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))

            // After a user joins or leaves
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {    //start HTTP server
    console.log(`Server is up on port ${port}!`)
})