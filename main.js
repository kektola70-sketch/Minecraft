import * as THREE from 'three';

// --- КОНФИГУРАЦИЯ FIREBASE (Твои данные) ---
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
    t.magFilter = THREE.NearestFilter; // Делает пиксели четкими (как в МС)
    t.minFilter = THREE.NearestFilter;
    return t;
};

// Ссылки на текстуры (Pixel Art)
const tex = {
    grassSide: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass_dirt.png'),
    grassTop: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass.png'),
    dirt: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/dirt.png'),
    stone: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/physics_images/grid.png'), // Временная для камня
    wood: loadTex('https://threejs.org/examples/textures/crate.gif') // Для дерева
};

// Создание материалов
const materials = {
    grass: [
        new THREE.MeshStandardMaterial({map: tex.grassSide}), // right
        new THREE.MeshStandardMaterial({map: tex.grassSide}), // left
        new THREE.MeshStandardMaterial({map: tex.grassTop}),  // top
        new THREE.MeshStandardMaterial({map: tex.dirt}),      // bottom
        new THREE.MeshStandardMaterial({map: tex.grassSide}), // front
        new THREE.MeshStandardMaterial({map: tex.grassSide})  // back
    ],
    dirt: new THREE.MeshStandardMaterial({map: tex.dirt}),
    stone: new THREE.MeshStandardMaterial({color: 0x808080}), // Если нет картинки, используем цвет
    wood: new THREE.MeshStandardMaterial({map: tex.wood})
};

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0, velocityY = 0, isJumping = false;
let selectedBlock = 'grass';

window.showScreen = (id) => {
    document.querySelectorAll('.screen, #ui-game').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
};

// --- ЛОГИКА ИГРЫ ---
window.initGame = (worldData) => {
    document.getElementById('ui-game').style.display = 'block';
    document.getElementById('screen-menu').style.display = 'none';
    document.getElementById('screen-worlds').style.display = 'none';

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 1);
    scene.add(light);
    raycaster = new THREE.Raycaster();

    // Генерация пола
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for(let x = -10; x < 10; x++) {
        for(let z = -10; z < 10; z++) {
            const b = new THREE.Mesh(geo, materials.grass);
            b.position.set(x, 0, z);
            scene.add(b);
            blocks.push(b);
        }
    }

    camera.position.set(0, 5, 5);
    setupControls();
    animate();
};

function setupControls() {
    // Джойстик
    nipplejs.create({ zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '50px', top: '50px'} })
    .on('move', (e, d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    // Вращение
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

    // Слоты хотбара
    document.querySelectorAll('.slot').forEach(slot => {
        slot.onclick = () => {
            if(!slot.dataset.block) return;
            document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            selectedBlock = slot.dataset.block;
        };
    });

    // Кнопки
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
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), materials[selectedBlock] || materials.grass);
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            scene.add(b);
            blocks.push(b);
        }
    };
}

function animate() {
    requestAnimationFrame(animate);
    
    // Камера
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const target = new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position);
    camera.lookAt(target);

    // Гравитация
    velocityY -= 0.008;
    camera.position.y += velocityY;
    if(camera.position.y < 2) { camera.position.y = 2; velocityY = 0; isJumping = false; }

    // Движение
    if(moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        camera.position.addScaledVector(dir, moveF * 0.1);
        camera.position.addScaledVector(side, moveR * 0.1);
    }
    renderer.render(scene, camera);
}