import * as THREE from 'three';

// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs",
  projectId: "minecraft-34cd5",
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- ПАРАМЕТРЫ ФИЗИКИ ---
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.35;
const GRAVITY = 0.008;
const JUMP_FORCE = 0.15;
const SPEED = 0.12;

let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0;
let velocityY = 0, onGround = false;
let selectedBlock = 'grass';

// --- ТЕКСТУРЫ ---
const loader = new THREE.TextureLoader();
const loadTex = (url) => {
    const t = loader.load(url);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    return t;
};

const textures = {
    grassSide: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass_dirt.png'),
    grassTop: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass.png'),
    dirt: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/dirt.png'),
    stone: loadTex('https://threejs.org/examples/textures/grid.png'),
    wood: loadTex('https://threejs.org/examples/textures/crate.gif')
};

const materials = {
    grass: [
        new THREE.MeshStandardMaterial({map: textures.grassSide}), new THREE.MeshStandardMaterial({map: textures.grassSide}),
        new THREE.MeshStandardMaterial({map: textures.grassTop}), new THREE.MeshStandardMaterial({map: textures.dirt}),
        new THREE.MeshStandardMaterial({map: textures.grassSide}), new THREE.MeshStandardMaterial({map: textures.grassSide})
    ],
    dirt: new THREE.MeshStandardMaterial({map: textures.dirt}),
    stone: new THREE.MeshStandardMaterial({map: textures.stone}),
    wood: new THREE.MeshStandardMaterial({map: textures.wood}),
    leaves: new THREE.MeshStandardMaterial({color: 0x2d5a27, transparent: true, opacity: 0.8})
};

// --- ИНТЕРФЕЙС ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen, #ui-game').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
    if(id === 'screen-worlds') updateWorldsList();
};

document.getElementById('btn-login').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if(nick.length < 3) return alert("Ник короткий!");
    await db.collection("players").doc(nick).set({ lastSeen: Date.now() }, { merge: true });
    localStorage.setItem('mc_nick', nick);
    document.getElementById('display-nick').innerText = nick;
    showScreen('screen-menu');
};

window.createNewWorld = () => {
    const world = { name: document.getElementById('world-name').value || "Мир", seed: Math.random(), id: Date.now() };
    initGame(world);
};

function updateWorldsList() {
    const list = document.getElementById('worlds-list');
    list.innerHTML = '<button onclick="initGame({seed:123})">Быстрый мир</button>';
}

// --- ФУНКЦИЯ ПРОВЕРКИ КОЛЛИЗИЙ (ХИТБОКСЫ) ---
function checkCollision(pos) {
    const playerBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, pos.y - 0.9, pos.z), // Центр игрока
        new THREE.Vector3(PLAYER_RADIUS * 2, PLAYER_HEIGHT, PLAYER_RADIUS * 2)
    );

    for (let i = 0; i < blocks.length; i++) {
        const blockBox = new THREE.Box3().setFromObject(blocks[i]);
        if (playerBox.intersectsBox(blockBox)) {
            return true;
        }
    }
    return false;
}

// --- ЯДРО ИГРЫ ---
function initGame(world) {
    showScreen('ui-game');
    document.getElementById('ui-game').style.display = 'block';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    raycaster = new THREE.Raycaster();

    // Генерация
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for(let x = -8; x < 8; x++) {
        for(let z = -8; z < 8; z++) {
            const b = new THREE.Mesh(geo, materials.grass);
            b.position.set(x, 0, z);
            scene.add(b);
            blocks.push(b);
        }
    }

    camera.position.set(0, 5, 0);
    setupControls();
    animate();
}

function setupControls() {
    // Джойстик
    nipplejs.create({ zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '60px', top: '60px'} })
    .on('move', (e, d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    // Обзор
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

    document.getElementById('btn-jump').onclick = () => { if(onGround) velocityY = JUMP_FORCE; };
    
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
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), materials[selectedBlock] || materials.grass);
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            if (!checkCollision(camera.position)) { // Не ставим блок в себя
                scene.add(b);
                blocks.push(b);
            }
        }
    };

    document.querySelectorAll('.slot').forEach(s => {
        s.onclick = () => {
            if(!s.dataset.block) return;
            document.querySelectorAll('.slot').forEach(sl => sl.classList.remove('active'));
            s.classList.add('active');
            selectedBlock = s.dataset.block;
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

    // --- ФИЗИКА И ДВИЖЕНИЕ ---
    const oldPos = camera.position.clone();

    // 1. Гравитация и прыжок (Ось Y)
    velocityY -= GRAVITY;
    camera.position.y += velocityY;
    onGround = false;

    if (checkCollision(camera.position)) {
        if (velocityY < 0) onGround = true; // Мы упали на блок
        camera.position.y = oldPos.y;
        velocityY = 0;
    }

    // 2. Движение (Оси X и Z)
    if (moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();

        const moveVec = new THREE.Vector3()
            .addScaledVector(dir, moveF * SPEED)
            .addScaledVector(side, moveR * SPEED);

        // Проверка X
        camera.position.x += moveVec.x;
        if (checkCollision(camera.position)) camera.position.x = oldPos.x;

        // Проверка Z
        camera.position.z += moveVec.z;
        if (checkCollision(camera.position)) camera.position.z = oldPos.z;
    }

    renderer.render(scene, camera);
}

// Старт
const savedNick = localStorage.getItem('mc_nick');
if(savedNick) {
    document.getElementById('display-nick').innerText = savedNick;
    showScreen('screen-menu');
} else {
    showScreen('screen-auth');
}