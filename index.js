//let scrambleSolutions = []
//let guessedWords = []
let timer

function establishConnection() {
  //Opens a websocket which receives broadcasted info from Rails
  window.App = {}
  window.App.cable = ActionCable.createConsumer(`wss://noggle.herokuapp.com/cable?token=${sessionStorage.getItem('userId')}`)
  return window.App.cable.subscriptions.create("GameInstanceChannel", {
  connected() {
    console.log('we made it')
  },
    received(data) {
      console.log(data)
      if(data.users) {
        if (!sessionStorage.gameId){
          displayOnlineUsers(data)
        }
      }
      else if (data.current_game) {
        displayCountDown()
        setTimeout(() => displayGame(data.current_game), 3000)
      }
      else if (data.scores) {
        displayScores(data.scores)
      }
      else if (data.final_scores) {
        sessionStorage.removeItem('gameId')
        clearInterval(timer)
        displayEndGame(data.final_scores)
      }
      else if (data.message)
        displayMessage(data.message)
    }
  })
}

document.addEventListener('DOMContentLoaded', (event) => {
  sessionStorage.clear();
  let usernameForm = document.getElementById('user-login')
  //add event listener to post a new user to our database
  usernameForm.addEventListener('submit', (event) => {
    event.preventDefault()
    let username = document.getElementById("username").value
    fetch("http://noggle.herokuapp.com/users", {
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'username': username.toLowerCase()})
    })
    .then(res => res.json())
    .then( json => {
      if (json.errors) {
        alert(json.errors.username)
      } else {
        //if a user comes back, now connect to the websocket and show online users
        sessionStorage.setItem('userId', json.user.id)
        establishConnection()
        setTimeout(fetchUsers, 400)
      }
    })
  })
})

//show all online users
function displayOnlineUsers(data){

  document.body.innerHTML = usersOnlineHTML
  let onlineDiv = document.getElementById('users-online')
  let startButton = document.getElementById('start-game')
  let messageForm = document.getElementById('message-form')
  let leaderBoardTable = document.getElementById('leaderboard')
  onlineDiv.innerHTML = "<h2>Currently Online: </h2>"

  //display top scores
  let place = 1;
  data.high_scores.forEach(score => {
    let tr = document.createElement('tr')
    tr.innerHTML = `<td>${place}</td><td>${score.user}</td><td>${score.points}</td>`
    leaderBoardTable.append(tr)
    place++;
  })
  //disable button if a game is currently being played
  if (data.game) {
    sessionStorage.setItem('gameId', data.game)
    startButton.innerText = "Game In Progress"
    startButton.disabled = true
  }
  $("#card").flip();
  //add event listener to start button to make a game
  startButton.addEventListener('click', (event) => {
    fetch("http://noggle.herokuapp.com/games", {
      method: 'post',
      headers: {'Content-Type': 'application/json'}
    })
  })

  //display online users
  data.users.forEach(user => {
    let newP = document.createElement('p')
    newP.innerText = user.username
    newP.style.color = `rgba(${user.color}, 1)`
    onlineDiv.append(newP)
  })

  //add event listener to post a message
  messageForm.addEventListener('submit', (event) => {
    event.preventDefault()
    let message = document.getElementById('message').value
    fetch('http://noggle.herokuapp.com/messages', {
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: {user: parseInt(sessionStorage.userId), content: message}})
    })
    document.getElementById('message').value = ""
  })
}

function displayGame(gameData) {
  sessionStorage.setItem('gameId', gameData.game_data.id)
  let guessedWords = []
  document.body.innerHTML = gameHTML
  //Get and set the div with the scrammbled letters
  let scrambleDiv = document.getElementById('scramble')
  for (let i = 0; i < gameData.game_data.scramble.length; i++) {
    scrambleDiv.innerHTML += `<span class="shake shake-constant shake-hard">${gameData.game_data.scramble.charAt(i)}</span>`
  }
  let scrambleSolutions = gameData.game_data.solutions
  //Get the score for this user and set their scoreId in sessionStorage
  let score = gameData.scores.find( score => parseInt(sessionStorage.getItem('userId')) === score.user_id)
  sessionStorage.setItem('scoreId', score.id)
  displayScores(gameData)
  //countdown for game time
  timer =  setInterval(
  function countdown() {
    let timerDiv = document.getElementById('timer')
    if (parseInt(timerDiv.innerText) > 0){
    timerDiv.innerText =  parseInt(timerDiv.innerText) - 1
    } else {
      fetch(`http://noggle.herokuapp.com/games/${sessionStorage.getItem("gameId")}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'}
      })
    }
  }, 1000)

  //Check a users submitted word against scrambleSolutions
  let submissionForm = document.getElementById('submission-form')
  submissionForm.addEventListener('submit', (event) => {
    event.preventDefault()
    let userWord = document.getElementById('submission').value
    document.getElementById('submission').value = ""
    checkUserWord(userWord, scrambleSolutions, guessedWords)
  })
}

//called when a new message is received
function displayMessage(gameData){
  let newMessage = document.getElementById('messages-ul')
  let newLi = document.createElement('Li')
  newLi.className = 'user-message-li'
  newLi.innerHTML = `<b style="color:rgba(${gameData.user_color}, 1)">${gameData.user_name}</b>: ${gameData.content}`
  newMessage.append(newLi)
  //always scroll to the bottom if there's too many messages
  $('#messages').scrollTop($('#messages')[0].scrollHeight);

}


function displayScores(gameData) {
  //Add everyones score to the scoreboard
  let scoreboardTable = document.getElementById('scoreboard')
  scoreboardTable.innerHTML= ""
  gameData.users.forEach(user => {
    let userScore = gameData.scores.find( score => user.id === score.user_id)
    let newTr = document.createElement('tr')
    newTr.innerHTML = `<td>${user.username}</td><td>${userScore.points}</td>`
    scoreboard.append(newTr)
  })
}



function checkUserWord(word, scrambleSolutions, guessedWords){
  //Checks word is a solution and sends it back to api as a score update
  if (scrambleSolutions.includes(word) && (!guessedWords.includes(word))) {
    let nogtastic = new Audio('./sound/Nogtastic.wav');
    let nogtacular = new Audio('./sound/Nogtacular.wav');
    if (word.length >= 7) {
      nogtacular.play();
    }
    else if (word.length >= 5) {
      nogtastic.play();
    }
    fetch(`http://noggle.herokuapp.com/scores/${sessionStorage.getItem('scoreId')}`,{
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(
        {score: {points: word.length, game: parseInt(sessionStorage.getItem('gameId'))}})
    })
    guessedWords.push(word)
    showGuessedWords(guessedWords)
    $('#attempts').scrollTop($('#attempts')[0].scrollHeight)
  }
}

//show all the words that were guessed
function showGuessedWords(guessedWords){
  let attemptsOne = document.getElementById('attempts-1')
  let attemptsTwo = document.getElementById('attempts-2')

  attemptsOne.innerText = ''
  attemptsTwo.innerText = ''

  for (let i = 0; i < guessedWords.length; i++) {
    let attemptLi = document.createElement('li')
    attemptLi.innerText = guessedWords[i]
    if (i % 2 === 0) {
      attemptsOne.append(attemptLi);
    }
    else {
      attemptsTwo.append(attemptLi);
    }
  }
}

function fetchUsers() {
  fetch("http://noggle.herokuapp.com/users")
}

function displayEndGame(finalScores) {
  document.body.innerHTML = gameOverHTML;
  const endGame = new Audio('./sound/EndGame.wav');
  endGame.play();
  let scoreboard = document.getElementById('scoreboard')
  //get the winners and display them
  let winners = []
  finalScores.winner.forEach(score => {
    winners.push(finalScores.users.find(user => user.id === score.user_id).username)
  })
  let winnerDiv = document.getElementById('winner');
  if (winners.length === 1) {
    winnerDiv.innerHTML = `<h1>${winners[0] + ' wins!'}</h1>`
  }
  else {
    let winnerString = winners.slice(0,-1).join(', ') + ` & ${winners.pop()}`
    winnerDiv.innerText = winnerString + ' win!'
  }
  //display final scores
  finalScores.users.forEach(user => {
    let userScore = finalScores.scores.find( score => user.id === score.user_id)
    let newTr = document.createElement('tr')
    newTr.innerHTML = `<td>${user.username}</td><td>${userScore.points}</td>`
    scoreboard.append(newTr)
  })
  //add event listener to start over button
  let startOver = document.getElementById("start-over")
  startOver.addEventListener('click', event => {
    document.body.innerHTML = usersOnlineHTML
    fetchUsers()
  })
}

function displayCountDown() {
  const ready = new Audio('./sound/Ready.wav');
  ready.play();
}
