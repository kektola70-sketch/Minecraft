import * as THREE from 'three';

// --- ТВOИ КОНФИГ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs",
  authDomain: "minecraft-34cd5.firebaseapp.com",
  projectId: "minecraft-34cd5",
  storageBucket: "minecraft-34cd5.firebasestorage.app",
  messagingSenderId: "334775687884",
  appId: "1:334775687884:web:46ea4b3315222280f3c069"
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- ПЕРЕМЕННЫЕ ---
let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0;
let velocityY = 0, isJumping = false;
let selectedColor = 0x44aa44;

// --- АККАУНТ И МЕНЮ ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen, #ui-game').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
    if(id === 'screen-worlds') updateWorldsList();
};

document.getElementById('btn-auth').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if(nick.length < 3) return alert("Ник слишком короткий!");
    
    try {
        const userRef = db.collection("players").doc(nick);
        await userRef.set({ lastSeen: Date.now() }, { merge: true });
        localStorage.setItem('mc_nick', nick);
        document.getElementById('display-nick').innerText = nick;
        alert("Ник сохранен в Firebase!");
        showScreen('screen-menu');
    } catch(e) {
        alert("Ошибка базы: " + e.message);
    }
};

// --- СПИСОК МИРОВ ---
window.createNewWorld = () => {
    const world = {
        name: document.getElementById('world-name').value || "Мир",
        seed: document.getElementById('world-seed').value || 123,
        mode: document.getElementById('world-mode').value,
        id: Date.now()
    };
    let worlds = JSON.parse(localStorage.getItem('mc_worlds') || '[]');
    worlds.push(world);
    localStorage.setItem('mc_worlds', JSON.stringify(worlds));
    initGame(world);
};

function updateWorldsList() {
    const list = document.getElementById('worlds-list');
    list.innerHTML = '';
    let worlds = JSON.parse(localStorage.getItem('mc_worlds') || '[]');
    worlds.forEach(w => {
        const btn = document.createElement('button');
        btn.innerText = `${w.name} (${w.mode})`;
        btn.onclick = () => initGame(w);
        list.appendChild(btn);
    });
}

// --- ИГРА ---
function initGame(worldData) {
    document.getElementById('ui-game').style.display = 'block';
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    raycaster = new THREE.Raycaster();

    // Генерация мира
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
    const s = Number(worldData.seed);
    
    for(let x = -10; x < 10; x++) {
        for(let z = -10; z < 10; z++) {
            const h = Math.floor(Math.sin(x * 0.2 + s) * 1.5 + Math.cos(z * 0.2 + s) * 1.5);
            const b = new THREE.Mesh(geo, mat);
            b.position.set(x, h, z);
            scene.add(b);
            blocks.push(b);
        }
    }

    camera.position.set(0, 5, 5);
    setupControls();
    animate();
}

function setupControls() {
    // Джойстик
    nipplejs.create({ zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '60px', top: '60px'} })
    .on('move', (e, d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    // Обзор (БЕЗ инверсии)
    let tx, ty;
    document.addEventListener('touchstart', e => { if(e.touches[0].clientX > window.innerWidth/2){ tx = e.touches[0].clientX; ty = e.touches[0].clientY; }});
    document.addEventListener('touchmove', e => {
        for(let t of e.touches) {
            if(t.clientX > window.innerWidth/2) {
                lon += (t.clientX - tx) * 0.3;
                lat += (t.clientY - ty) * 0.3;
                lat = Math.max(-85, Math.min(85, lat));
                tx = t.clientX; ty = t.clientY;
            }
        }
    });

    // Прыжок
    document.getElementById('btn-jump').onclick = () => { if(!isJumping) { velocityY = 0.15; isJumping = true; }};

    // Ломать/Ставить
    document.getElementById('btn-break').onclick = () => {
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 5) {
            scene.remove(hit[0].object);
            blocks.splice(blocks.indexOf(hit[0].object), 1);
        }
    };

    document.getElementById('btn-place').onclick = () => {
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 5) {
            const p = hit[0].object.position;
            const n = hit[0].face.normal;
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: Number(selectedColor)}));
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            scene.add(b);
            blocks.push(b);
        }
    };

    // Слоты
    document.querySelectorAll('.slot').forEach(s => {
        s.onclick = () => {
            document.querySelectorAll('.slot').forEach(sl => sl.classList.remove('active'));
            s.classList.add('active');
            selectedColor = s.dataset.color;
        };
    });
}

function animate() {
    if(!renderer) return;
    requestAnimationFrame(animate);

    // Камера
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    // Физика
    velocityY -= 0.008;
    camera.position.y += velocityY;
    if(camera.position.y < 2.5) { camera.position.y = 2.5; velocityY = 0; isJumping = false; }

    // Движение
    if(moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        camera.position.addScaledVector(dir, moveF * 0.15);
        camera.position.addScaledVector(side, moveR * 0.15);
    }
    renderer.render(scene, camera);
}

// Загрузка ника
const savedNick = localStorage.getItem('mc_nick');
if(savedNick) document.getElementById('display-nick').innerText = savedNick;