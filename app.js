import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get } 
from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

/* 🔥 Firebase Config */
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

let roomId, roomRef, myId;

const PATTERNS = ["early_five","early_top","early_middle","early_bottom","full_house"];
const numbers90 = () => Array.from({length:90},(_,i)=>i+1);

/* ---------- NORMALIZER ---------- */
function normalizeRoom(d) {
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

/* ---------- CREATE ROOM ---------- */
window.createRoom = () => {
  const host = hostName.value.trim();
  const price = +ticketPrice.value;
  if (!host || !price) return alert("Enter details");

  myId = "host_" + Date.now();
  roomId = Math.random().toString(36).substring(2,8);
  roomRef = ref(db,"rooms/"+roomId);

  set(roomRef,{
    meta:{ hostId:myId, iteration:1, status:"setup", ticketPrice:price },
    players:{},
    tickets:{},
    prizes:{},
    game:{ current:null, drawn:[], available:numbers90() },
    winnings:{}
  });

  setup.hidden=true;
  hostPanel.hidden=false;
  roomLabel.innerText=roomId;

  initPrizeInputs();
  listenRoom();
};

/* ---------- HOST ---------- */
function isHost(d){ return d.meta.hostId===myId }

function initPrizeInputs(){
  prizeInputs.innerHTML="";
  PATTERNS.forEach(p=>{
    const i=document.createElement("input");
    i.id="prize_"+p;
    i.placeholder=`${p.replace("_"," ")} prize ₹`;
    prizeInputs.appendChild(i);
  });
}

window.addPlayer = () => {
  set(ref(db,`rooms/${roomId}/players/p_${Date.now()}`),
    {name:playerName.value});
  playerName.value="";
};

window.startGame = () => {
  const prizes={};
  PATTERNS.forEach(p=>prizes[p]=+document.getElementById("prize_"+p).value||0);
  update(roomRef,{prizes,"meta/status":"running"});
  hostPanel.hidden=true;
  game.hidden=false;
};

/* ---------- GAME ---------- */
window.drawNumber = async () => {
  const snap = await get(roomRef);
  const d = normalizeRoom(snap.val());
  if (!isHost(d) || !d.game.available.length) return;

  const idx = Math.floor(Math.random() * d.game.available.length);
  const num = d.game.available[idx];

  update(roomRef,{
    "game/current":num,
    "game/drawn":[...d.game.drawn,num],
    "game/available":d.game.available.filter(n=>n!==num)
  });
};

window.declareWin = ()=>{
  get(roomRef).then(s=>{
    const d=normalizeRoom(s.val());
    if(!isHost(d)) return;

    const iter=`iteration_${d.meta.iteration}`;
    set(ref(db,`rooms/${roomId}/winnings/${iter}/${winType.value}`),
      {player:winnerPlayer.value});
  });
};

window.resetGame = ()=>{
  get(roomRef).then(s=>{
    const d=normalizeRoom(s.val());
    if(!isHost(d)) return;

    update(roomRef,{
      "meta/iteration":d.meta.iteration+1,
      game:{current:null,drawn:[],available:numbers90()}
    });
  });
};

/* ---------- LISTENER ---------- */
function listenRoom(){
  onValue(roomRef,snap=>{
    if(!snap.exists()) return;
    const d=normalizeRoom(snap.val());

    iterationLabel.innerText="Iteration "+d.meta.iteration;
    current.innerText=d.game.current??"--";

    if(d.meta.status!=="running") return;

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
  winType.innerHTML=PATTERNS.map(p=>`<option>${p}</option>`).join("");
}

function renderTickets(d){
  tickets.innerHTML="";
  const iter=`iteration_${d.meta.iteration}`;

  for(const id in d.players){
    const inp=document.createElement("input");
    inp.type="number";
    inp.placeholder=`${d.players[id].name} tickets`;
    inp.value=d.tickets?.[iter]?.[id];

    if(!isHost(d)) inp.disabled=true;

    inp.onchange=()=>{
      set(
        ref(db,`rooms/${roomId}/tickets/${iter}/${id}`),
        +inp.value
      );
    };

    tickets.appendChild(inp);
  }
}

function renderWinners(d){
  winners.innerHTML="";
  for(const iter in d.winnings){
    let t=`<table><tr><th colspan="2">${iter}</th></tr>`;
    for(const p in d.winnings[iter]){
      t+=`<tr>
        <td>${p}</td>
        <td>${d.players[d.winnings[iter][p].player].name}</td>
      </tr>`;
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
    html+=`<tr>
      <td>${d.players[id].name}</td>
      <td>₹${paid}</td>
      <td>₹${won}</td>
      <td class="${net>=0?"profit":"loss"}">₹${net}</td>
    </tr>`;
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



