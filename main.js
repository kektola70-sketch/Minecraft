import * as THREE from 'three';

// --- НАСТРОЙКИ СЦЕНЫ ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Голубое небо

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- ОСВЕЩЕНИЕ ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
sunLight.position.set(10, 20, 10);
scene.add(sunLight);

// --- СОЗДАНИЕ МИРА (Блоки) ---
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });

// Генерируем небольшую платформу 20x20
for (let x = -10; x < 10; x++) {
    for (let z = -10; z < 10; z++) {
        const block = new THREE.Mesh(boxGeo, grassMat);
        block.position.set(x, 0, z);
        scene.add(block);
    }
}

camera.position.y = 2; // Рост игрока

// --- УПРАВЛЕНИЕ (ДЖОЙСТИК) ---
let moveForward = 0;
let moveRight = 0;

const joystick = nipplejs.create({
    zone: document.getElementById('joystick-container'),
    mode: 'static',
    position: { left: '60px', top: '60px' },
    color: 'white',
    size: 100
});

joystick.on('move', (evt, data) => {
    moveForward = data.vector.y;
    moveRight = data.vector.x;
});

joystick.on('end', () => {
    moveForward = 0;
    moveRight = 0;
});

// --- ВРАЩЕНИЕ КАМЕРОЙ (ТАЧПАД) ---
let lon = 0, lat = 0;
let phi = 0, theta = 0;

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    // Используем правую часть экрана для обзора
    if (e.touches[0].clientX > window.innerWidth / 2) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
}, false);

document.addEventListener('touchmove', (e) => {
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > window.innerWidth / 2) {
            const dx = e.touches[i].clientX - touchStartX;
            const dy = e.touches[i].clientY - touchStartY;

            lon -= dx * 0.2; // Чувствительность по горизонтали
            lat -= dy * 0.2; // Чувствительность по вертикали
            lat = Math.max(-85, Math.min(85, lat));

            touchStartX = e.touches[i].clientX;
            touchStartY = e.touches[i].clientY;
        }
    }
}, false);

// --- ГЛАВНЫЙ ЦИКЛ ИГРЫ ---
const velocity = 0.12; // Скорость ходьбы

function animate() {
    requestAnimationFrame(animate);

    // 1. Обновление вращения камеры
    phi = THREE.MathUtils.degToRad(90 - lat);
    theta = THREE.MathUtils.degToRad(lon);

    const target = new THREE.Vector3();
    target.setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    // 2. Движение игрока
    if (moveForward !== 0 || moveRight !== 0) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0; 
        direction.normalize();

        const sideDirection = new THREE.Vector3().crossVectors(camera.up, direction).normalize();

        // Вперед/назад
        camera.position.addScaledVector(direction, moveForward * velocity);
        // Влево/вправо
        camera.position.addScaledVector(sideDirection, moveRight * velocity);
    }

    renderer.render(scene, camera);
}

// Адаптация под поворот экрана
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();