import * as THREE from 'three';

// --- НАСТРОЙКИ ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0); // Центр экрана

// Свет
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(10, 20, 10);
scene.add(sun);

// --- МИР ---
const geometry = new THREE.BoxGeometry(1, 1, 1);
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
const dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
const blocks = []; // Массив для хранения всех блоков мира

function createBlock(x, y, z, mat) {
    const block = new THREE.Mesh(geometry, mat);
    block.position.set(x, y, z);
    scene.add(block);
    blocks.push(block);
}

// Генерация пола
for (let x = -8; x < 8; x++) {
    for (let z = -8; z < 8; z++) {
        createBlock(x, 0, z, grassMaterial);
    }
}

camera.position.set(0, 2, 5);

// --- ЛОГИКА ИНВЕНТАРЯ ---
let selectedSlot = 1;
const placeBtn = document.getElementById('btn-place');
const slots = document.querySelectorAll('.slot:not(.btn-inv)');

slots.forEach(slot => {
    slot.onclick = () => {
        slots.forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        selectedSlot = slot.dataset.id;
        
        // Показываем кнопку "СТАВИТЬ" только если выбран слот с блоком (в нашем примере первые 3)
        if (parseInt(selectedSlot) <= 3) {
            placeBtn.style.display = 'block';
        } else {
            placeBtn.style.display = 'none';
        }
    };
});

// Кнопка Инвентаря
document.getElementById('open-inv').onclick = () => alert("Инвентарь открыт!");

// --- ДЕЙСТВИЯ: ЛОМАТЬ И СТАВИТЬ ---
function getTargetBlock() {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(blocks);
    return intersects.length > 0 ? intersects[0] : null;
}

// ЛОМАТЬ
document.getElementById('btn-break').onclick = () => {
    const target = getTargetBlock();
    if (target && target.distance < 5) {
        scene.remove(target.object);
        const index = blocks.indexOf(target.object);
        if (index > -1) blocks.splice(index, 1);
    }
};

// СТАВИТЬ
placeBtn.onclick = () => {
    const target = getTargetBlock();
    if (target && target.distance < 5) {
        const pos = target.object.position;
        const norm = target.face.normal;
        
        // Определяем материал по слоту
        let mat = grassMaterial;
        if (selectedSlot == "2") mat = dirtMaterial;
        
        createBlock(pos.x + norm.x, pos.y + norm.y, pos.z + norm.z, mat);
    }
};

// УДАР (просто анимация или лог)
document.getElementById('btn-hit').onclick = () => {
    console.log("Удар!");
};

// --- УПРАВЛЕНИЕ И ОБЗОР ---
// (Код джойстика и обзора из прошлого шага)
let moveForward = 0, moveRight = 0;
const joystick = nipplejs.create({
    zone: document.getElementById('joystick-container'),
    mode: 'static', position: { left: '60px', top: '60px' },
    color: 'white'
});
joystick.on('move', (e, d) => { moveForward = d.vector.y; moveRight = d.vector.x; });
joystick.on('end', () => { moveForward = 0; moveRight = 0; });

let lon = 0, lat = 0;
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    if (e.touches[0].clientX > window.innerWidth / 2) {
        touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    }
});
document.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > window.innerWidth / 2) {
            lon -= (e.touches[i].clientX - touchStartX) * 0.2;
            lat -= (e.touches[i].clientY - touchStartY) * 0.2;
            lat = Math.max(-85, Math.min(85, lat));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY;
        }
    }
});

function animate() {
    requestAnimationFrame(animate);
    
    // Камера
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    // Ходьба
    if (moveForward !== 0 || moveRight !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        camera.position.addScaledVector(dir, moveForward * 0.1);
        camera.position.addScaledVector(side, moveRight * 0.1);
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});