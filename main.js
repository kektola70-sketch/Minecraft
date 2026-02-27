import * as THREE from 'three';

// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs",
  projectId: "minecraft-34cd5",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- ЗАГРУЗКА ТЕКСТУР ---
const loader = new THREE.TextureLoader();
const loadTex = (url) => {
    const t = loader.load(url);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
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
        new THREE.MeshStandardMaterial({map: textures.grassSide}),
        new THREE.MeshStandardMaterial({map: textures.grassSide}),
        new THREE.MeshStandardMaterial({map: textures.grassTop}),
        new THREE.MeshStandardMaterial({map: textures.dirt}),
        new THREE.MeshStandardMaterial({map: textures.grassSide}),
        new THREE.MeshStandardMaterial({map: textures.grassSide})
    ],
    dirt: new THREE.MeshStandardMaterial({map: textures.dirt}),
    stone: new THREE.MeshStandardMaterial({map: textures.stone}),
    wood: new THREE.MeshStandardMaterial({map: textures.wood}),
    leaves: new THREE.MeshStandardMaterial({color: 0x2d5a27, transparent: true, opacity: 0.8})
};

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0, velocityY = 0, isJumping = false;
let selectedBlock = 'grass';

// --- НАВИГАЦИЯ ---
window.showScreen = (id) => {
    document.querySelectorAll('.screen, #ui-game').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
    if(id === 'screen-worlds') updateWorldsList();
};

// --- ВХОД В АККАУНТ ---
document.getElementById('btn-login').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if(nick.length < 3) return alert("Ник слишком короткий!");
    
    try {
        await db.collection("players").doc(nick).set({ lastSeen: Date.now() }, { merge: true });
        localStorage.setItem('mc_nick', nick);
        document.getElementById('display-nick').innerText = nick;
        showScreen('screen-menu');
    } catch(e) {
        alert("Ошибка Firebase: " + e.message);
    }
};

// --- СОЗДАНИЕ МИРА ---
window.createNewWorld = () => {
    const world = {
        name: document.getElementById('world-name').value || "Мой мир",
        seed: document.getElementById('world-seed').value || Math.floor(Math.random()*1000),
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

// --- ЯДРО ИГРЫ ---
function initGame(worldData) {
    showScreen('ui-game');
    document.getElementById('ui-game').style.display = 'block';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    raycaster = new THREE.Raycaster();

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const s = Number(worldData.seed);

    for(let x = -10; x < 10; x++) {
        for(let z = -10; z < 10; z++) {
            const h = Math.floor(Math.sin(x*0.2 + s) * 1.5 + Math.cos(z*0.2 + s) * 1.5);
            const b = new THREE.Mesh(geo, materials.grass);
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
    nipplejs.create({ zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '55px', top: '55px'} })
    .on('move', (e, d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    let tx, ty;
    document.addEventListener('touchstart', e => {
        if(e.touches[0].clientX > window.innerWidth/2) {
            tx = e.touches[0].clientX; ty = e.touches[0].clientY;
        }
    }, {passive: false});

    document.addEventListener('touchmove', e => {
        for(let t of e.touches) {
            if(t.clientX > window.innerWidth/2) {
                // ИСПРАВЛЕННАЯ ИНВЕРСИЯ: тянем вправо -> lon растет -> поворот вправо
                lon += (t.clientX - tx) * 0.3;
                lat += (t.clientY - ty) * 0.3; // тянем вниз -> lat растет -> смотрим вниз
                lat = Math.max(-85, Math.min(85, lat));
                tx = t.clientX; ty = t.clientY;
            }
        }
    }, {passive: false});

    document.querySelectorAll('.slot').forEach(slot => {
        slot.onclick = () => {
            if(!slot.dataset.block) return;
            document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            selectedBlock = slot.dataset.block;
        };
    });

    document.getElementById('btn-jump').onclick = () => { if(!isJumping) { velocityY = 0.15; isJumping = true; }};
    
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
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), materials[selectedBlock]);
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            scene.add(b);
            blocks.push(b);
        }
    };
}

function animate() {
    if(!renderer) return;
    requestAnimationFrame(animate);

    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    velocityY -= 0.008;
    camera.position.y += velocityY;
    if(camera.position.y < 2.5) { camera.position.y = 2.5; velocityY = 0; isJumping = false; }

    if(moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        camera.position.addScaledVector(dir, moveF * 0.12);
        camera.position.addScaledVector(side, moveR * 0.12);
    }
    renderer.render(scene, camera);
}

// При старте проверяем локальный ник
const savedNick = localStorage.getItem('mc_nick');
if(savedNick) {
    document.getElementById('display-nick').innerText = savedNick;
    showScreen('screen-menu');
} else {
    showScreen('screen-auth');
}