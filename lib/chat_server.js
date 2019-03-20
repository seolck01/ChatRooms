const socketio = require('socket.io')
var io
var guestNumber = 1
var nickNames = {}
var namesUsed = []
var currentRoom = {}
exports.listen = function (server) {
  io = socketio.listen(server)
  io.set('log level', 1)
  io.sockets.on('connection', function (socket) {  // 定义每个用 户连接的处 理逻辑
    guestNumber = assignGuestName(socket, guestNumber, nickNames, nameUsed) //  在用户连接上来时 赋予其一个访客名
    joinRoom(socket, 'Lobby')
    handleMessageBroadcasting(socket, nickNames)  // 处理用户的消息， 更名，以及聊天室 的创建和变更
    handleNameChangeAttempts(socket, nickNames, namesUsed)
    handleRoomJoining(socket)
    socket.on('rooms', function() {   // 用户发出请求时，向 其提供已经被占用的 聊天室的列表
      socket.emit('rooms', io.sockets.manager.rooms)
    })
    handleClientDisconnection(socket, nickNames, namesUsed) //  定义用户断开 连接后的清除 逻辑
  })
}

function assignGuestName(socket, guestNumber, nickNames, nameUsed) {
  var name = 'Guest' + guestNumber
  nickNames[socket.id] = name
  socket.emit('nameResult', {
    success: true,
    name: name
  })
  namesUsed.push(name)
  return guestNumber + 1 // 增加用来生成昵称的计数器
}
function joinRoom(socket, room) {
  socket.join(room)
  currentRoom(socket.id) = room
  socket.emit('joinResult', {room: room})
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + 'has joined' + room + '.'
  })
  var usersInRoom = io.sockets.clients(room)
  if (usersInRoom.length > 1) {
    var usersInRoomSummary = 'Users currently in' + room + ':'
    for (var index in usersInRoom) {
      var userSocketId = usersInRoom[index].id
      if (userSocketId != socket.id) {
        if (index > 0) {
          usersInRoomSummary += ','
        }
        usersInRoomSummary += nickNames[userSocketId]
      }
    }
    usersInRoomSummary += '.'
    socket.emit('message', {text: usersInRoomSummary})
  }
}
function handleNameChangeAttempts(socket, nickNames, nameUsed) {
  socket.on('nameAttempt', function(name) {
    if (name.indexOf('Guest') === 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest".'
      })
    } else {
      if (namesUsed.indexOf(name) === -1) {
        var previousName = nickNames[socket.id]
        var previousNameIndex = namesUsed.indexOf(previousName)
        namesUsed.push(name)
        nickNames[socket.id] = name
        delete nameUsed[previousNameIndex]
        socket.emit('nameResult', {
          success: true,
          name: name
        })
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + 'is now known as ' + name + '.'
        })
      } else {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use'
        })
      }
    } 
  })
}
function handleMessageBroadcasting(socket) {
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ':' + message.text
    })
  })
}
function handleRoomJoining(socket) {
  socket.on('join', function(room) {
    socket.leave(currentRoom[socket.id])
    joinRoom(socket, room.newRoom)
  })
}
function handleClientDisconnection(socket) {
  socket.on('disconnect', function() {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id])
    delete nameUsed[nameIndex]
    delete nickNames[socket.id]
  })
}