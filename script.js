// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Game Setup ---
const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const message = document.getElementById('message');
const restartBtn = document.getElementById('restart');
const moonScoreElem = document.getElementById('moonScore');
const sunScoreElem = document.getElementById('sunScore');

let playerSymbol = prompt("Choose your symbol: 🌑 (Moon) or ☀️ (Sun)") || '🌑';
let turn = '🌑';
let gameId = "cosmic-game";
let boardState = Array(9).fill('');
let scores = { "🌑":0, "☀️":0 };
const gameRef = db.ref('games/' + gameId);

// Listen to realtime updates
gameRef.on('value', snapshot => {
  const data = snapshot.val();
  if (!data) return;

  boardState = data.board || Array(9).fill('');
  turn = data.turn || '🌑';
  scores = data.scores || { "🌑":0, "☀️":0 };
  updateBoard();
  updateScoreboard();
  checkWinnerOnline();
});

function updateBoard() {
  cells.forEach((cell, idx) => cell.textContent = boardState[idx]);
  message.textContent = `${turn === '🌑' ? 'Moon' : 'Sun'}'s Turn`;
}

function updateScoreboard() {
  moonScoreElem.textContent = `🌑 ${scores['🌑']}`;
  sunScoreElem.textContent = `☀️ ${scores['☀️']}`;
}

function checkWinnerOnline() {
  const winningCombos = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let combo of winningCombos) {
    const [a,b,c] = combo;
    if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
      message.textContent = `${boardState[a] === '🌑' ? 'Moon' : 'Sun'} Wins! 🎉`;
      scores[boardState[a]] += 1;
      setTimeout(resetBoard, 2000);
      gameRef.update({ scores });
      return true;
    }
  }
  if (!boardState.includes('')) {
    message.textContent = "It's a Draw! 🤝";
    setTimeout(resetBoard, 2000);
    return true;
  }
  return false;
}

function makeMove(e) {
  const index = e.target.dataset.index;
  if (!boardState[index] && turn === playerSymbol) {
    boardState[index] = playerSymbol;
    turn = turn === '🌑' ? '☀️' : '🌑';
    gameRef.set({ board: boardState, turn: turn, scores });
  }
}

function resetBoard() {
  boardState = Array(9).fill('');
  turn = '🌑';
  gameRef.set({ board: boardState, turn: turn, scores });
}

cells.forEach(cell => cell.addEventListener('click', makeMove));
restartBtn.addEventListener('click', resetBoard);
