const path = require('path') // to serve public dir, path는 core node module이라 install not required
const http = require('http')
const socketio = require('socket.io')
const express = require('express')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')
const app = express()
const server = http.createServer(app)// 안해도 Express가 background에서 하는 작업임.
const io = socketio(server) // http server를 socketio에 넘겨줘야하므로 위에서 server 선언한 것. 

const PORT = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))


// --counter example--
// server (emit) => client(receive) - countUpdated
// client(emit) => server(receive) - increment
//send event, count는 client sidedml socket으로 받을 수 있다. 특정 single connection 으로 send => emit
// socket.emit('countUpdated', count) //send event, count는 client sidedml socket으로 받을 수 있다. 특정 single connection 으로 send => emit
    // socket.on('increment', () => {
    //     count++
    //     io.emit('countUpdated', count)
    // })

io.on('connection', (socket) => { // socket == object that contains info of connection
    console.log('new websocket connection!')
    
    socket.on('join', ({username, room}, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room })

        if (error) {
            return callback(error) // acknoledgement. error를 client side로 보냄.
        }
        socket.join(user.room)

        socket.emit('message', generateMessage({text: 'Welcome!', username: 'Admin'}))
        socket.broadcast.to(user.room).emit('message', generateMessage({text: `${user.username} has joined!`, username: 'Admin'}))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        
        callback() // acknowledgement without error
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)

        if(!user) return callback('Cannot find user')
        
        const filter = new Filter()
        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed')
        }

        io.to(user.room).emit('message', generateMessage({text: message, username: user.username}))
        callback()
    })
    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id)

        if(!user) return callback('Cannot find user')

        io.to(user.room).emit('locationMessage', generateLocationMessage({url: `http://google.com/maps?q=${location.latitude},${location.longitude}`, username: user.username}))
        callback()
    })
    socket.on('disconnect', ()=>{
        const user = removeUser(socket.id)

        if(user) {
            io.to(user.room).emit('message', generateMessage({text:`${user.username} has left!`, username:'Admin' }))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }

    })
})
server.listen(PORT, () => {
    console.log(`server on port ${PORT}!`)
})
