import * as THREE from 'three';

// --- CONFIG FIREBASE ---
const firebaseConfig = { apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs", projectId: "minecraft-34cd5" };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- ИНВЕНТАРЬ ---
let inventory = { grass: 64, dirt: 64, stone: 64, wood: 64, leaves: 64 };
function updateInventoryUI() {
    for (let key in inventory) {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = inventory[key];
    }
}

// --- ФИЗИКА И ПАРАМЕТРЫ ---
const PLAYER_HEIGHT = 1.7;
const GRAVITY = 0.008;
const SPEED = 0.1;
let velocityY = 0, onGround = false;

let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0;
let selectedBlock = 'grass';

// --- ТЕКСТУРЫ ---
const loader = new THREE.TextureLoader();
const matGrass = new THREE.MeshStandardMaterial({color: 0x5d9948});
const matDirt = new THREE.MeshStandardMaterial({color: 0x8b4513});
const matStone = new THREE.MeshStandardMaterial({color: 0x808080});
const matWood = new THREE.MeshStandardMaterial({color: 0x6b411a});
const matLeaves = new THREE.MeshStandardMaterial({color: 0x2d5a27});

const blockMaterials = { grass: matGrass, dirt: matDirt, stone: matStone, wood: matWood, leaves: matLeaves };

// --- ЯДРО ИГРЫ ---
window.initGame = (world) => {
    document.getElementById('ui-game').style.display = 'block';
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    raycaster = new THREE.Raycaster();

    // Генерация площадки
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for(let x = -10; x < 10; x++) {
        for(let z = -10; z < 10; z++) {
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
        new THREE.Vector3(0.6, PLAYER_HEIGHT, 0.6)
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
        if(hit.length > 0 && hit[0].distance < 5) {
            const type = 'grass'; // Для примера, можно определять по материалу
            if(inventory[type] < 64) inventory[type]++;
            scene.remove(hit[0].object);
            blocks.splice(blocks.indexOf(hit[0].object), 1);
            updateInventoryUI();
        }
    };

    document.getElementById('btn-place').onclick = () => {
        if(inventory[selectedBlock] <= 0) return;
        raycaster.setFromCamera({x:0, y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 5) {
            const p = hit[0].object.position;
            const n = hit[0].face.normal;
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), blockMaterials[selectedBlock]);
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            if(!checkCollision(camera.position)) {
                scene.add(b);
                blocks.push(b);
                inventory[selectedBlock]--;
                updateInventoryUI();
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
    requestAnimationFrame(animate);
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    const oldPos = camera.position.clone();

    // Y (Гравитация)
    velocityY -= GRAVITY;
    camera.position.y += velocityY;
    if (checkCollision(camera.position)) {
        if (velocityY < 0) onGround = true;
        camera.position.y = oldPos.y;
        velocityY = 0;
    }

    // XZ (Движение + АВТО-ПРЫЖОК)
    if (moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const moveVec = new THREE.Vector3().addScaledVector(dir, moveF * SPEED).addScaledVector(side, moveR * SPEED);

        // Пробуем шагнуть
        camera.position.x += moveVec.x;
        camera.position.z += moveVec.z;

        if (checkCollision(camera.position)) {
            // ЛОГИКА АВТО-ПРЫЖКА: пробуем подняться на 1.1 вверх
            camera.position.y += 1.1;
            if (checkCollision(camera.position)) {
                // Если всё равно коллизия (стена выше 1 блока), отменяем всё
                camera.position.copy(oldPos);
            } else {
                // Если запрыгнули, плавно опускаемся (уже делает гравитация)
            }
        }
    }
    renderer.render(scene, camera);
}

// Старт ника
document.getElementById('btn-login').onclick = () => {
    const nick = document.getElementById('input-nick').value;
    if(nick) {
        localStorage.setItem('mc_nick', nick);
        showScreen('screen-menu');
    }
};
if(localStorage.getItem('mc_nick')) showScreen('screen-menu');
updateInventoryUI();