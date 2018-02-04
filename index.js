const express = require('express');
const path = require('path');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use('/rsrc', express.static(path.join(__dirname, '/rsrc/')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
});

let chatlog = [];
const users = [];

io.on('connection', (socket) => {
  //  This is seen as the User connecting, by checking for the user settings
  socket.on('user setting', (msg) => {
    let username;
    //  If the msg is null, the cookie hasnt been set yet
    if (msg === null) {
      //  Generate random Username
      username = Math.floor(Math.random() * 10000);
      //  user: socket.id, username, namecolor, textcolor
      const userArray = [socket.id, username, '', ''];
      users.push(userArray);
    } else {
      const settings = JSON.parse(msg);
      username = settings[0];
      const userArray = [socket.id, settings[0], settings[1], settings[2]];
      users.push(userArray);
    }

    //  Send the new User all of the Chatlog
    if (chatlog.length > 0) {
      for (let i = 0; i < chatlog.length; i += 1) {
        socket.emit('chat message', chatlog[i]);
      }
      //Send a linebreak to indicate the break between past and current chat
      socket.emit('chat message', '<hr>');
    }

    console.log(`a user connected: ${username} with Socket ID: ${socket.id}`);
    io.emit('chat message', `<i> ${username} connected</i>`);
    chatlog.push(`<i> ${username} connected</i>`);
  });

  socket.on('chat message', (msg) => {
    //  Find Username by the socket.id
    let username;
    let userIndex;
    for (let i = 0; i < users.length; i += 1) {
      if (users[i][0] === socket.id) {
        username = users[i][1];
        userIndex = i;
        break;
      }
    }

    if (msg.substring(0, 5) === '!HELP') { //  Check for '!HELP' command
      console.log(`User requested help text: ${username}`);
      const msgtext = '<i><b>Type "!CLEAR" to clear the chat.<br>' +
                    'Type "!NAME=" + [Name] to change your Username (no "^" or "!" allowed).<br>' +
                    'Type "!NAMECOLOR=" + [colorcode] to change your Username color.<br>' +
                    'Type "!TEXTCOLOR=" + [colorcode] to change your Text color.<br>' +
                    'Type "!WHOISONLINE" to see which User is Online.<br>' +
                    'Type "!PRIVATE" + ^[name]^ + [message] to send a private, temporary message to an online User. No Color Support</b></i>';

      socket.emit('chat message', msgtext);
    } else if (msg.substring(0, 6) === '!CLEAR') { //  Check for '!CLEAR' command
      console.log('Clearing Chat...');
      io.emit('clear');
      chatlog = [];
    } else if (msg.substring(0, 6) === '!NAME=') { //  Check for '!NAME=' command
      const oldName = users[userIndex][1];
      let newName = msg.substring(6, msg.length);
      newName = newName.replace('!', '');
      newName = newName.replace('^', '');
      users[userIndex][1] = newName;

      console.log(`User ${username} changed his Name to: ${newName}`);
      const msgtext = `<i>User ${username} changed his Name to: ${newName}`;
      io.emit('chat message', msgtext);
      chatlog.push(msgtext);
    } else if (msg.substring(0, 11) === '!NAMECOLOR=') { //  Check for '!NAMECOLOR=' command
      const oldNameColor = users[userIndex][2];
      const newNameColor = msg.substring(11, msg.length);
      users[userIndex][2] = newNameColor;

      console.log(`User ${username} changed Name his Color from: ${oldNameColor} to: ${newNameColor}`);
      const msgtext = `<i>User ${username} changed his Name Color from: ${oldNameColor} to: ${newNameColor}</i>`;
      io.emit('chat message', msgtext);
      chatlog.push(msgtext);
    } else if (msg.substring(0, 11) === '!TEXTCOLOR=') { //  Check for '!TEXTCOLOR=' command
      const oldTextColor = users[userIndex][3];
      const newTextColor = msg.substring(11, msg.length);
      users[userIndex][3] = newTextColor;

      console.log(`User ${username} changed his Text Color from: ${oldTextColor} to: ${newTextColor}`);
      const msgtext = `<i>User ${username} changed his Text Color from: ${oldTextColor} to: ${newTextColor}</i>`;
      io.emit('chat message', msgtext);
      chatlog.push(msgtext);
    } else if (msg.substring(0, 12) === '!WHOISONLINE') { //  Check for '!WHOISONLINE' command
      console.log(`User ${username} requested Online List`);

      let msgtext = `<i><b>List of Online Users:<br>`;

      for (let i = 0; i < users.length; i += 1) {
        msgtext += `${users[i][1]}<br>`;
      }

      socket.emit('chat message', msgtext);
    } else if (msg.substring(0, 8) === '!PRIVATE') { //  Check for '!PRIVATE' command
      //  First, get the Target User
      const firstNameDivider = msg.indexOf('^');
      const secondNameDivider = msg.indexOf('^', firstNameDivider + 1);
      const targetUser = msg.substring(firstNameDivider + 1, secondNameDivider);
      const targetMessage = msg.substring(secondNameDivider + 1, msg.length);
      //  Search for target User in Userarray
      let targetUserSocketID = undefined;
      for (let i = 0; i < users.length; i += 1) {
        if (users[i][1] === targetUser) {
          targetUserSocketID = users[i][0];
          break;
        }
      }
      //  Send Error Message to Sender Socket if the User is unknown
      if (typeof targetUserSocketID === 'undefined') {
        console.log(`Private Message from ${username} to ${targetUser} failed, unknown target. Message: ${targetMessage}`);
        socket.emit('chat message', `<i style="color:red"><b>Failed to send Private Message to ${targetUser}, unknown User or Offline. Message: ${targetMessage}</b></i>`);
      } else { // Send Message to Both Sockets
        socket.emit('chat message', `<i>(private) You to'${targetUser}':</i> ${targetMessage}`);
        io.to(targetUserSocketID).emit('chat message', `<i>(private) From '${username}' to You:</i> ${targetMessage}`);
      }

    } else { // Output Chat Message
      console.log(`user: ${username} | message: ${msg}`);
      const msgtext = `<i style="color:${users[userIndex][2]}">${username}:</i> <span style="color:${users[userIndex][3]}">${msg}</span>`;
      io.emit('chat message', msgtext);
      chatlog.push(msgtext);
    }

    //some weird case
    if (typeof username !== 'undefined') {
      //  Create Array with Settings of the User to save as a Cookies
      const userSettings = [users[userIndex][1], users[userIndex][2], users[userIndex][3]];
      socket.emit('set cookie', JSON.stringify(userSettings));
    }
    
  });

  socket.on('disconnect', () => {
    //  Find Username by the socket.id
    let username;
    let userIndex;

    for (let i = 0; i < users.length; i += 1) {
      if (users[i][0] === socket.id) {
        username = users[i][1];
        userIndex = i;
        break;
      }
    }

    console.log(`a user disconnected: ${username} with Socket ID: ${socket.id}`);
    io.emit('chat message', `<i>User ${username} disconnected</i>`);
    chatlog.push(`<i>User ${username} disconnected</i>`);

    //  Remove the current User from the array
    for (let i = userIndex + 1; i < users.length; i += 1) {
      users[i - 1] = users[i];
    }
    users.pop();
  });
});

http.listen(process.env.PORT, () => {
  console.log(`listening on *:${process.env.PORT}`);
});
