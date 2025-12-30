import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get }
from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyATYxYA5Z9LlZdV56zx5gqVjzQjLHzwpKY",
  authDomain: "tambola-8abb7.firebaseapp.com",
  projectId: "tambola-8abb7",
  storageBucket: "tambola-8abb7.firebasestorage.app",
  messagingSenderId: "50822051042",
  appId: "1:50822051042:web:984e839380e094c9d29abb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let roomId, roomRef;

const PATTERNS = [
  { key: "early_five", label: "Early Five" },
  { key: "early_top", label: "Top Row" },
  { key: "early_middle", label: "Middle Row" },
  { key: "early_bottom", label: "Bottom Row" },
  { key: "full_house", label: "Full House" }
];

const numbers90 = () => Array.from({length:90},(_,i)=>i+1);

window.toggleTickets = () => tickets.classList.toggle("collapsed");

/* ---------- NORMALIZER ---------- */
function normalize(d){
  return {
    meta: d?.meta ?? {},
    players: d?.players ?? {},
    tickets: d?.tickets ?? {},
    prizes: d?.prizes ?? {},
    winnings: d?.winnings ?? {},
    game: {
      current: d?.game?.current ?? null,
      drawn: Array.isArray(d?.game?.drawn) ? d.game.drawn : [],
      available: Array.isArray(d?.game?.available) ? d.game.available : []
    }
  };
}

/* ---------- JOIN ROOM ---------- */
window.joinRoom = async () => {
  roomId = joinRoomId.value.trim();
  if (!roomId) return;

  roomRef = ref(db, "rooms/" + roomId);
  const snap = await get(roomRef);
  if (!snap.exists()) return alert("Room not found");

  joinBox.hidden = true;
  setup.hidden = true;

  listenRoom(); // 🔥 listener decides UI, NOT joinRoom
};


/* ---------- CREATE ROOM ---------- */
window.createRoom = () => {
  roomId = Math.random().toString(36).substring(2,8);
  roomRef = ref(db,"rooms/"+roomId);

  set(roomRef,{
    meta:{ iteration:1, status:"setup", ticketPrice:+ticketPrice.value },
    players:{},
    tickets:{},
    prizes:{},
    winnings:{},
    game:{ current:null, drawn:[], available:numbers90() }
  });

  joinBox.hidden = true;
  setup.hidden = true;
  panel.hidden = false;
  roomLabel.innerText = roomId;

  initPrizeInputs();
  listenRoom();
};

/* ---------- ROOM ACTIONS (ANYONE CAN DO) ---------- */
function initPrizeInputs(){
  prizeInputs.innerHTML = "";
  PATTERNS.forEach(p => {
    const i = document.createElement("input");
    i.type = "number";
    i.placeholder = p.label + " Prize ₹";
    i.onchange = () =>
      update(roomRef, { [`prizes/${p.key}`]: +i.value || 0 });
    prizeInputs.appendChild(i);
  });
}


window.addPlayer = () => {
  if(!playerName.value) return;
  set(ref(db,`rooms/${roomId}/players/p_${Date.now()}`),
    {name:playerName.value});
  playerName.value="";
};

window.startGame = () => {
  update(roomRef, { "meta/status": "running" });

  // ✅ Force UI transition immediately
  panel.hidden = true;
  game.hidden = false;
};


window.drawNumber = async () => {
  const d=normalize((await get(roomRef)).val());
  if(!d.game.available.length) return;

  const num=d.game.available[Math.floor(Math.random()*d.game.available.length)];
  update(roomRef,{
    "game/current":num,
    "game/drawn":[...d.game.drawn,num],
    "game/available":d.game.available.filter(n=>n!==num)
  });
};

window.declareWin = async () => {
  const d=normalize((await get(roomRef)).val());
  const iter=`iteration_${d.meta.iteration}`;
  if(d.winnings?.[iter]?.[winType.value]) return;

  set(ref(db,`rooms/${roomId}/winnings/${iter}/${winType.value}`),
    {player:winnerPlayer.value});
};

window.resetGame = async () => {
  const d=normalize((await get(roomRef)).val());
  update(roomRef,{
    "meta/iteration":d.meta.iteration+1,
    game:{current:null,drawn:[],available:numbers90()}
  });
};

/* ---------- LISTENER ---------- */
function listenRoom(){
  onValue(roomRef, snap => {
    if (!snap.exists()) return;

    const d = normalize(snap.val());

    roomLabel.innerText = roomId;
    iterationLabel.innerText = "Iteration " + d.meta.iteration;
    current.innerText = d.game.current ?? "--";

    // ✅ PHASE CONTROL
    if (d.meta.status === "setup") {
      panel.hidden = false;
      game.hidden = true;
    }

    if (d.meta.status === "running") {
      panel.hidden = true;
      game.hidden = false;
    }

    renderBoard(d.game.drawn);
    renderPlayers(d.players);
    renderTickets(d);
    renderWinners(d);
    renderSettlement(d);
  });
}


/* ---------- UI ---------- */
function renderBoard(drawn){
  board.innerHTML="";
  for(let i=1;i<=90;i++){
    const s=document.createElement("span");
    s.innerText=i;
    if(drawn.includes(i)) s.classList.add("drawn");
    board.appendChild(s);
  }
}

function renderPlayers(players){
  winnerPlayer.innerHTML="";
  for(const id in players){
    const o=document.createElement("option");
    o.value=id;
    o.innerText=players[id].name;
    winnerPlayer.appendChild(o);
  }
  winType.innerHTML = PATTERNS
  .map(p => `<option value="${p.key}">${p.label}</option>`)
  .join("");
}

function renderTickets(d){
  tickets.innerHTML="";
  const iter=`iteration_${d.meta.iteration}`;

  for(const id in d.players){
    const inp=document.createElement("input");
    inp.type="number";
    inp.placeholder=`${d.players[id].name} tickets`;
    inp.value=d.tickets?.[iter]?.[id]||"";
    inp.onchange=()=>set(
      ref(db,`rooms/${roomId}/tickets/${iter}/${id}`),
      +inp.value||0
    );
    tickets.appendChild(inp);
  }
}

function renderWinners(d){
  winners.innerHTML="";
  for(const iter in d.winnings){
    let t=`<table><tr><th colspan=2>${iter}</th></tr>`;
    for(const p in d.winnings[iter]){
      t+=`<tr><td>${p}</td>
      <td>${d.players[d.winnings[iter][p].player]?.name}</td></tr>`;
    }
    winners.innerHTML+=t+"</table>";
  }
}

function renderSettlement(d){
  let html="<table><tr><th>Player</th><th>Paid</th><th>Won</th><th>Net</th></tr>";
  for(const id in d.players){
    let paid=0,won=0;
    for(const iter in d.tickets)
      paid+=(d.tickets[iter][id]||0)*d.meta.ticketPrice;
    for(const iter in d.winnings)
      for(const p in d.winnings[iter])
        if(d.winnings[iter][p].player===id)
          won+=d.prizes[p]||0;

    const net=won-paid;
    html+=`<tr><td>${d.players[id].name}</td>
      <td>₹${paid}</td><td>₹${won}</td>
      <td class="${net>=0?"profit":"loss"}">₹${net}</td></tr>`;
  }
  settlement.innerHTML=html+"</table>";
}




{/*
<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyATYxYA5Z9LlZdV56zx5gqVjzQjLHzwpKY",
    authDomain: "tambola-8abb7.firebaseapp.com",
    projectId: "tambola-8abb7",
    storageBucket: "tambola-8abb7.firebasestorage.app",
    messagingSenderId: "50822051042",
    appId: "1:50822051042:web:984e839380e094c9d29abb",
    measurementId: "G-LCHKBQFL5Y"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
*/
}



