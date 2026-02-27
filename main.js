import * as THREE from 'three';

// --- CONFIG FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs", 
    projectId: "minecraft-34cd5" 
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- ПАРАМЕТРЫ И ИНВЕНТАРЬ ---
let inventory = { grass:64, dirt:64, stone:64, wood:64, leaves:64, planks:64, glass:64, cobble:64 };
let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0, velocityY = 0;
let selectedBlock = 'grass';

// --- АВТОРИЗАЦИЯ ---
const authMsg = document.getElementById('auth-msg');

document.getElementById('btn-reg').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if(nick.length < 3) return authMsg.innerText = "Ник слишком короткий!";
    const doc = await db.collection("players").doc(nick).get();
    if(doc.exists) {
        authMsg.innerText = "Этот ник уже занят!";
    } else {
        await db.collection("players").doc(nick).set({ created: Date.now() });
        login(nick);
    }
};

document.getElementById('btn-login').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if(!nick) return;
    const doc = await db.collection("players").doc(nick).get();
    if(doc.exists) login(nick); else authMsg.innerText = "Ник не найден!";
};

function login(nick) {
    localStorage.setItem('mc_nick', nick);
    document.getElementById('display-nick').innerText = nick;
    showScreen('screen-menu');
}

window.logout = () => { localStorage.removeItem('mc_nick'); location.reload(); };

window.showScreen = (id) => {
    document.querySelectorAll('.screen, #ui-game').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
};

// --- РЕАЛИСТИЧНАЯ ГРАФИКА (HD ТЕКСТУРЫ) ---
const texLoader = new THREE.TextureLoader();
const loadHD = (url) => {
    const t = texLoader.load(url);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
};

// Ссылки на HD текстуры
const tex = {
    grassTop: loadHD('https://threejs.org/examples/textures/terrain/grasslight-big.jpg'),
    grassSide: loadHD('https://images.unsplash.com/photo-1550747528-cdb45925b3f7?q=80&w=256&h=256&auto=format&fit=crop'),
    dirt: loadHD('https://threejs.org/examples/textures/terrain/backgroundcontrolled.jpg'),
    stone: loadHD('https://images.unsplash.com/photo-1516937941344-00b4e0337589?q=80&w=256&h=256&auto=format&fit=crop'),
    wood: loadHD('https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256&h=256&auto=format&fit=crop'),
    planks: loadHD('https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg')
};

const createMat = (map) => new THREE.MeshStandardMaterial({ map: map, roughness: 0.8 });

const materials = {
    grass: [createMat(tex.grassSide), createMat(tex.grassSide), createMat(tex.grassTop), createMat(tex.dirt), createMat(tex.grassSide), createMat(tex.grassSide)],
    dirt: createMat(tex.dirt),
    stone: createMat(tex.stone),
    wood: createMat(tex.wood),
    leaves: new THREE.MeshStandardMaterial({ color: 0x1a3300, roughness: 1 }),
    planks: createMat(tex.planks),
    glass: new THREE.MeshStandardMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.4, roughness: 0.1 }),
    cobble: createMat(tex.stone)
};

// --- ЯДРО ИГРЫ ---
document.getElementById('btn-start-game').onclick = () => {
    showScreen('ui-game');
    document.getElementById('ui-game').style.display = 'block';
    init();
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 5, 25); // Реалистичный туман

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Улучшенное освещение
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemiLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(5, 15, 10);
    scene.add(sunLight);

    raycaster = new THREE.Raycaster();

    // Генерация пола
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
    loop();
}

// --- ХИТБОКСЫ И КОЛЛИЗИИ ---
function checkCollision(pos) {
    const pBox = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, pos.y - 0.85, pos.z),
        new THREE.Vector3(0.5, 1.7, 0.5)
    );
    const bBox = new THREE.Box3();
    for(let i=0; i<blocks.length; i++) {
        bBox.setFromObject(blocks[i]);
        if(pBox.intersectsBox(bBox)) return true;
    }
    return false;
}

function setupControls() {
    // Джойстик
    nipplejs.create({ zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '50px', top: '50px'} })
    .on('move', (e, d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    // Обзор (БЕЗ ИНВЕРСИИ)
    let tx, ty;
    document.addEventListener('touchstart', e => { 
        if(e.touches[0].clientY < window.innerHeight * 0.75) {
            tx = e.touches[0].clientX; ty = e.touches[0].clientY; 
        }
    });
    document.addEventListener('touchmove', e => {
        for(let t of e.touches) {
            if(t.clientY < window.innerHeight * 0.75) {
                lon += (t.clientX - tx) * 0.35;
                lat += (t.clientY - ty) * 0.35;
                lat = Math.max(-85, Math.min(85, lat));
                tx = t.clientX; ty = t.clientY;
            }
        }
    });

    // Хотбар
    document.querySelectorAll('.slot').forEach(s => {
        s.onclick = () => {
            if(!s.dataset.block) return;
            document.querySelectorAll('.slot').forEach(l => l.classList.remove('active'));
            s.classList.add('active');
            selectedBlock = s.dataset.block;
        };
    });

    // Логика кнопок
    document.getElementById('btn-break').onclick = () => {
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 4) {
            scene.remove(hit[0].object);
            blocks.splice(blocks.indexOf(hit[0].object), 1);
        }
    };

    document.getElementById('btn-place').onclick = () => {
        if(inventory[selectedBlock] <= 0) return;
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 4) {
            const p = hit[0].object.position;
            const n = hit[0].face.normal;
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), materials[selectedBlock]);
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            if(!checkCollision(camera.position)) {
                scene.add(b);
                blocks.push(b);
                inventory[selectedBlock]--;
                updateInv();
            }
        }
    };
}

function updateInv() {
    document.querySelectorAll('.slot').forEach(s => {
        const id = s.dataset.block;
        if(id) s.querySelector('.count').innerText = inventory[id];
    });
}

function loop() {
    requestAnimationFrame(loop);
    
    // Поворот камеры
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position));

    const oldPos = camera.position.clone();

    // Гравитация
    velocityY -= 0.008;
    camera.position.y += velocityY;
    if(checkCollision(camera.position)) {
        camera.position.y = oldPos.y;
        velocityY = 0;
    }

    // Движение и Авто-прыжок
    if(moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const moveVec = new THREE.Vector3().addScaledVector(dir, moveF * 0.11).addScaledVector(side, moveR * 0.11);

        // Проверка по осям для плавного скольжения
        camera.position.x += moveVec.x;
        if(checkCollision(camera.position)) {
            camera.position.y += 1.05; // Проба авто-прыжка
            if(checkCollision(camera.position)) {
                camera.position.x = oldPos.x;
                camera.position.y = oldPos.y;
            }
        }

        camera.position.z += moveVec.z;
        if(checkCollision(camera.position)) {
            camera.position.y += 1.05; // Проба авто-прыжка
            if(checkCollision(camera.position)) {
                camera.position.z = oldPos.z;
                camera.position.y = oldPos.y;
            }
        }
    }
    renderer.render(scene, camera);
}

// Проверка сессии
const saved = localStorage.getItem('mc_nick');
if(saved) login(saved); else showScreen('screen-auth');
updateInv();