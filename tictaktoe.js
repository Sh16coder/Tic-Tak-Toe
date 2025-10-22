class SpaceTicTacToe {
    constructor() {
        this.currentPlayer = null;
        this.currentGame = null;
        this.gameRoom = null;
        this.playerSymbol = null;
        this.isMyTurn = false;
        this.gameActive = false;
        
        this.initializeEventListeners();
        this.checkAuthState();
    }

    initializeEventListeners() {
        // Auth events
        document.getElementById('playAsGuest').addEventListener('click', () => this.signInAsGuest());
        document.getElementById('googleLogin').addEventListener('click', () => this.signInWithGoogle());
        document.getElementById('logoutBtn').addEventListener('click', () => this.signOut());

        // Game mode events
        document.getElementById('createGameBtn').addEventListener('click', () => this.createGameRoom());
        document.getElementById('joinGameBtn').addEventListener('click', () => this.joinRandomGame());
        document.getElementById('singlePlayerBtn').addEventListener('click', () => this.startSinglePlayer());

        // Game control events
        document.getElementById('leaveGameBtn').addEventListener('click', () => this.leaveGame());
        document.getElementById('rematchBtn').addEventListener('click', () => this.requestRematch());
        document.getElementById('copyRoomCode').addEventListener('click', () => this.copyRoomCode());

        this.setupBoard();
        this.loadLeaderboard();
        this.listenForGameRooms();
    }

    // Firebase Auth Methods
    async signInAsGuest() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            alert('Please enter your cosmic name!');
            return;
        }

        try {
            // For guest access, we'll use Firestore directly since we don't need full auth
            this.currentPlayer = {
                uid: 'guest_' + Date.now(),
                displayName: playerName,
                isGuest: true
            };
            this.showGameSection();
        } catch (error) {
            console.error('Auth error:', error);
            alert('Failed to join space battle!');
        }
    }

    async signInWithGoogle() {
        // Implement Google Auth if desired
        alert('Google auth would be implemented here');
    }

    signOut() {
        this.leaveGame();
        this.currentPlayer = null;
        this.showAuthSection();
    }

    checkAuthState() {
        // Check if user was already authenticated
        const savedPlayer = localStorage.getItem('spacePlayer');
        if (savedPlayer) {
            this.currentPlayer = JSON.parse(savedPlayer);
            this.showGameSection();
        }
    }

    // Game Room Management
    async createGameRoom() {
        if (!this.currentPlayer) return;

        const roomCode = this.generateRoomCode();
        const gameRoom = {
            roomCode: roomCode,
            player1: {
                uid: this.currentPlayer.uid,
                name: this.currentPlayer.displayName,
                symbol: '🚀',
                score: 0
            },
            player2: null,
            board: Array(9).fill(''),
            currentTurn: '🚀',
            status: 'waiting',
            winner: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMoveAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('gameRooms').doc(roomCode).set(gameRoom);
            this.joinGameRoom(roomCode, '🚀');
        } catch (error) {
            console.error('Error creating game room:', error);
        }
    }

    async joinRandomGame() {
        const availableRooms = await db.collection('gameRooms')
            .where('status', '==', 'waiting')
            .orderBy('createdAt')
            .limit(10)
            .get();

        if (availableRooms.empty) {
            this.createGameRoom(); // No rooms available, create one
            return;
        }

        const room = availableRooms.docs[0];
        this.joinGameRoom(room.id, '🛸');
    }

    async joinGameRoom(roomCode, symbol) {
        try {
            this.gameRoom = db.collection('gameRooms').doc(roomCode);
            this.playerSymbol = symbol;

            if (symbol === '🛸') {
                await this.gameRoom.update({
                    player2: {
                        uid: this.currentPlayer.uid,
                        name: this.currentPlayer.displayName,
                        symbol: '🛸',
                        score: 0
                    },
                    status: 'active'
                });
            }

            this.setupGameListeners();
            this.showGameBoard();
        } catch (error) {
            console.error('Error joining game room:', error);
        }
    }

    // Real-time Game Listeners
    setupGameListeners() {
        this.gameRoom.onSnapshot((doc) => {
            if (doc.exists) {
                const gameData = doc.data();
                this.updateGameUI(gameData);
                
                if (gameData.status === 'finished' && !gameData.rematchRequested) {
                    this.updateLeaderboard(gameData.winner);
                }
            }
        });
    }

    updateGameUI(gameData) {
        // Update player info
        this.updatePlayerInfo(gameData);
        
        // Update board
        this.updateBoard(gameData.board);
        
        // Update game status
        this.updateGameStatus(gameData);
        
        // Check if it's my turn
        this.isMyTurn = gameData.currentTurn === this.playerSymbol;
        this.gameActive = gameData.status === 'active';
    }

    updatePlayerInfo(gameData) {
        document.getElementById('player1Info').innerHTML = `
            <span class="player-name">🚀 ${gameData.player1?.name || 'Waiting...'}</span>
            <div class="player-score">${gameData.player1?.score || 0}</div>
        `;

        document.getElementById('player2Info').innerHTML = `
            <span class="player-name">🛸 ${gameData.player2?.name || 'Waiting...'}</span>
            <div class="player-score">${gameData.player2?.score || 0}</div>
        `;

        document.getElementById('roomCode').textContent = this.gameRoom.id;
        
        // Highlight active player
        document.querySelectorAll('.player').forEach(player => player.classList.remove('active'));
        if (gameData.currentTurn === '🚀') {
            document.getElementById('player1Info').classList.add('active');
        } else {
            document.getElementById('player2Info').classList.add('active');
        }
    }

    updateBoard(board) {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = board[index] || '';
            cell.classList.toggle('taken', board[index] !== '');
        });
    }

    updateGameStatus(gameData) {
        const statusElement = document.getElementById('gameStatus');
        
        if (gameData.status === 'waiting') {
            statusElement.textContent = '⏳ Waiting for opponent to join...';
        } else if (gameData.status === 'finished') {
            if (gameData.winner === 'draw') {
                statusElement.textContent = '🤝 Cosmic Stalemate! It\'s a draw!';
            } else {
                statusElement.textContent = `🎉 ${gameData.winner} wins this space battle!`;
            }
        } else {
            statusElement.textContent = `🌠 ${gameData.currentTurn}'s turn to conquer space!`;
        }
    }

    // Game Logic
    async makeMove(cellIndex) {
        if (!this.gameActive || !this.isMyTurn) return;

        const gameDoc = await this.gameRoom.get();
        const gameData = gameDoc.data();

        if (gameData.board[cellIndex] !== '') return;

        const newBoard = [...gameData.board];
        newBoard[cellIndex] = this.playerSymbol;

        const winner = this.checkWinner(newBoard);
        const isDraw = !winner && newBoard.every(cell => cell !== '');

        const updateData = {
            board: newBoard,
            currentTurn: this.playerSymbol === '🚀' ? '🛸' : '🚀',
            lastMoveAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (winner || isDraw) {
            updateData.status = 'finished';
            updateData.winner = winner || 'draw';
            
            // Update scores
            if (winner) {
                if (winner === '🚀') {
                    updateData.player1.score = (gameData.player1.score || 0) + 1;
                } else {
                    updateData.player2.score = (gameData.player2.score || 0) + 1;
                }
            }
        }

        await this.gameRoom.update(updateData);
    }

    checkWinner(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        return null;
    }

    // UI Management
    showAuthSection() {
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('gameSection').style.display = 'none';
        localStorage.removeItem('spacePlayer');
    }

    showGameSection() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        document.getElementById('currentPlayerInfo').textContent = 
            `Welcome, ${this.currentPlayer.displayName}!`;
        
        localStorage.setItem('spacePlayer', JSON.stringify(this.currentPlayer));
    }

    showGameBoard() {
        document.getElementById('roomsSection').style.display = 'none';
        document.getElementById('gameBoardContainer').style.display = 'block';
    }

    setupBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => this.makeMove(i));
            board.appendChild(cell);
        }
    }

    // Room Management
    listenForGameRooms() {
        db.collection('gameRooms')
            .where('status', 'in', ['waiting', 'active'])
            .orderBy('lastMoveAt', 'desc')
            .limit(20)
            .onSnapshot((snapshot) => {
                this.updateRoomsList(snapshot.docs);
            });
    }

    updateRoomsList(rooms) {
        const roomsList = document.getElementById('roomsList');
        roomsList.innerHTML = '';

        rooms.forEach(doc => {
            const room = doc.data();
            const roomElement = document.createElement('div');
            roomElement.className = `room-item ${room.player2 ? 'full' : ''}`;
            roomElement.innerHTML = `
                <strong>Room: ${doc.id}</strong><br>
                Players: ${room.player1.name} ${room.player2 ? '+ ' + room.player2.name : ''}<br>
                Status: ${room.status}
            `;
            
            if (!room.player2) {
                roomElement.addEventListener('click', () => this.joinGameRoom(doc.id, '🛸'));
            }
            
            roomsList.appendChild(roomElement);
        });
    }

    // Utility Methods
    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async copyRoomCode() {
        if (this.gameRoom) {
            const inviteLink = `${window.location.origin}${window.location.pathname}?room=${this.gameRoom.id}`;
            await navigator.clipboard.writeText(inviteLink);
            alert('Invite link copied! Share it with your friend across the galaxy!');
        }
    }

    async leaveGame() {
        if (this.gameRoom) {
            // Clean up the game room if both players leave
            this.gameRoom.delete();
            this.gameRoom = null;
        }
        
        document.getElementById('roomsSection').style.display = 'block';
        document.getElementById('gameBoardContainer').style.display = 'none';
        this.gameActive = false;
    }

    async requestRematch() {
        if (this.gameRoom) {
            await this.gameRoom.update({
                board: Array(9).fill(''),
                status: 'active',
                winner: null,
                currentTurn: '🚀',
                rematchRequested: true
            });
        }
    }

    // Single Player Mode
    startSinglePlayer() {
        // Implement AI opponent
        alert('Single player mode with AI would be implemented here');
    }

    // Leaderboard
    async loadLeaderboard() {
        const leaderboardSnapshot = await db.collection('leaderboard')
            .orderBy('wins', 'desc')
            .limit(10)
            .get();

        const leaderboardElement = document.getElementById('leaderboard');
        leaderboardElement.innerHTML = '';

        leaderboardSnapshot.forEach((doc, index) => {
            const player = doc.data();
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${player.name}</span>
                <span class="leaderboard-wins">${player.wins} wins</span>
            `;
            leaderboardElement.appendChild(item);
        });
    }

    async updateLeaderboard(winner) {
        if (winner && winner !== 'draw') {
            const gameDoc = await this.gameRoom.get();
            const gameData = gameDoc.data();
            
            const winningPlayer = winner === '🚀' ? gameData.player1 : gameData.player2;
            
            const playerRef = db.collection('leaderboard').doc(winningPlayer.uid);
            const playerDoc = await playerRef.get();
            
            if (playerDoc.exists) {
                await playerRef.update({
                    wins: firebase.firestore.FieldValue.increment(1),
                    lastWin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await playerRef.set({
                    name: winningPlayer.name,
                    wins: 1,
                    lastWin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            this.loadLeaderboard(); // Refresh leaderboard
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SpaceTicTacToe();
});

// Handle room invites from URL
function handleRoomInvite() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    
    if (roomCode) {
        // Auto-join the room if user is authenticated
        const game = new SpaceTicTacToe();
        setTimeout(() => {
            if (game.currentPlayer) {
                game.joinGameRoom(roomCode, '🛸');
            }
        }, 1000);
    }
}
