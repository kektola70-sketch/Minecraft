import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// 1. Настройка сцены
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Небо

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. Освещение
const light = new THREE.HemisphereLight(0xeeeeee, 0x888888, 1);
scene.add(light);

// 3. Создание блоков (трава)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x44aa44 });

for (let x = -10; x < 10; x++) {
    for (let z = -10; z < 10; z++) {
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, 0, z);
        scene.add(cube);
    }
}

// 4. Управление
const controls = new PointerLockControls(camera, document.body);

// Клик по экрану для активации управления
document.body.addEventListener('click', () => {
    controls.lock();
});

camera.position.y = 2; // Рост игрока

// 5. Цикл отрисовки
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Адаптация под размер экрана
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});