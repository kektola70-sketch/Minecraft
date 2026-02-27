import * as THREE from 'three';

// --- CONFIG FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs", 
    projectId: "minecraft-34cd5" 
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- ПЕРЕМЕННЫЕ ---
let inventory = { grass: 64, dirt: 64, stone: 64, wood: 64 };
let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0, velocityY = 0, onGround = false;
let selectedBlock = 'grass';

// --- СИСТЕМА АВТОРИЗАЦИИ ---
const authMsg = document.getElementById('auth-msg');

// Функция РЕГИСТРАЦИИ
document.getElementById('btn-reg').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if (nick.length < 3) return authMsg.innerText = "Ник слишком короткий!";
    
    authMsg.style.color = "yellow";
    authMsg.innerText = "Регистрация...";

    const userRef = db.collection("players").doc(nick);
    const doc = await userRef.get();

    if (doc.exists) {
        authMsg.style.color = "#ff5555";
        authMsg.innerText = "Ник уже занят!";
    } else {
        await userRef.set({ registeredAt: Date.now() });
        login(nick);
    }
};

// Функция ВХОДА
document.getElementById('btn-login').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if (!nick) return;

    authMsg.style.color = "yellow";
    authMsg.innerText = "Вход...";

    const doc = await db.collection("players").doc(nick).get();
    if (doc.exists) {
        login(nick);
    } else {
        authMsg.style.color = "#ff5555";
        authMsg.innerText = "Ник не найден! Зарегистрируйтесь.";
    }
};

function login(nick) {
    localStorage.setItem('mc_nick', nick);
    document.getElementById('display-nick').innerText = nick;
    showScreen('screen-menu');
}

window.logout = () => {
    localStorage.removeItem('mc_nick');
    location.reload();
};

window.showScreen = (id) => {
    document.querySelectorAll('.screen, #ui-game').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
};

// --- ИГРОВАЯ ЛОГИКА ---
window.initGame = (world) => {
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

    // Пол
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const matGrass = new THREE.MeshStandardMaterial({color: 0x5d9948});
    for(let x = -8; x < 8; x++) {
        for(let z = -8; z < 8; z++) {
            const b = new THREE.Mesh(geo, matGrass);
            b.position.set(x, 0, z);
            scene.add(b);
            blocks.push(b);
        }
    }

    camera.position.set(0, 5, 0);
    setupControls();
    animate();
};

function checkCollision(pos) {
    const pBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, pos.y - 0.8, pos.z),
        new THREE.Vector3(0.6, 1.7, 0.6)
    );
    for (let b of blocks) {
        if (pBox.intersectsBox(new THREE.Box3().setFromObject(b))) return true;
    }
    return false;
}

function setupControls() {
    nipplejs.create({ zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '50px', top: '50px'} })
    .on('move', (e, d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    let tx, ty;
    document.addEventListener('touchstart', e => { 
        if(e.touches[0].clientY < window.innerHeight * 0.7) {
            tx = e.touches[0].clientX; ty = e.touches[0].clientY;
        }
    });
    document.addEventListener('touchmove', e => {
        for(let t of e.touches) {
            if(t.clientY < window.innerHeight * 0.7) {
                lon += (t.clientX - tx) * 0.4;
                lat += (t.clientY - ty) * 0.4;
                lat = Math.max(-85, Math.min(85, lat));
                tx = t.clientX; ty = t.clientY;
            }
        }
    });

    document.getElementById('btn-break').onclick = () => {
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 4) {
            if(inventory.grass < 64) inventory.grass++; 
            scene.remove(hit[0].object);
            blocks.splice(blocks.indexOf(hit[0].object), 1);
            updateUI();
        }
    };

    document.getElementById('btn-place').onclick = () => {
        if(inventory[selectedBlock] <= 0) return;
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 4) {
            const p = hit[0].object.position;
            const n = hit[0].face.normal;
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color: 0x8b4513}));
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            if(!checkCollision(camera.position)) {
                scene.add(b);
                blocks.push(b);
                inventory[selectedBlock]--;
                updateUI();
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

function updateUI() {
    for (let key in inventory) {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = inventory[key];
    }
}

function animate() {
    requestAnimationFrame(animate);
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    const oldPos = camera.position.clone();
    velocityY -= 0.008;
    camera.position.y += velocityY;
    if (checkCollision(camera.position)) {
        if (velocityY < 0) onGround = true;
        camera.position.y = oldPos.y;
        velocityY = 0;
    }

    if (moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const moveVec = new THREE.Vector3().addScaledVector(dir, moveF * 0.1).addScaledVector(side, moveR * 0.1);

        camera.position.x += moveVec.x;
        camera.position.z += moveVec.z;

        if (checkCollision(camera.position)) {
            // АВТО-ПРЫЖОК
            camera.position.y += 1.1;
            if (checkCollision(camera.position)) {
                camera.position.copy(oldPos);
            }
        }
    }
    renderer.render(scene, camera);
}

// ПРОВЕРКА ПРИ СТАРТЕ
const savedNick = localStorage.getItem('mc_nick');
if (savedNick) login(savedNick); else showScreen('screen-auth');
updateUI();