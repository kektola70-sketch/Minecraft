/* ==========================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
   ========================================== */
let scene, camera, renderer, raycaster;
let inventory;
let terrainMeshes = [];
let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

let gameConfig = { seed: 12345, mode: 'creative', type: 'default' };
const translations = {
    ru: { singleplayer: "Одиночная игра", multiplayer: "Сетевая игра", settings: "Настройки", language: "Язык", quit: "Выйти" },
    en: { singleplayer: "Singleplayer", multiplayer: "Multiplayer", settings: "Settings", language: "Language", quit: "Quit Game" }
};
let currentLang = 'ru';
let gameSettings = { fov: 75, renderDist: 8, music: false };
let simplex; // Шумовая функция

document.getElementById('splash-text').innerText = ["Big Hills!", "Water & Sand!", "Trees!", "Octave Noise!"][Math.floor(Math.random()*4)];

/* ==========================================
   МЕНЮ
   ========================================== */
function showScreen(screenId) {
    document.getElementById('menu-container').style.display = 'flex';
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');
    isGameRunning = false;
    if(document.pointerLockElement) document.exitPointerLock();
}

function openMenuFromGame() { showScreen('main-menu'); }

const gameModes = ['creative', 'survival', 'hardcore'];
const modeNames = { survival: "Выживание", hardcore: "Хардкор", creative: "Творческий" };
const modeDescs = { 
    survival: "Ресурсы, голод, гравитация.",
    hardcore: "Одна жизнь, сложно.",
    creative: "Полет, бессмертие, строительство."
};
let currentModeIndex = 0;

function cycleGameMode() {
    currentModeIndex = (currentModeIndex + 1) % gameModes.length;
    let mode = gameModes[currentModeIndex];
    document.getElementById('btn-gamemode').innerText = "Режим: " + modeNames[mode];
    document.getElementById('gamemode-desc').innerText = modeDescs[mode];
    if(mode === 'hardcore') document.getElementById('btn-gamemode').style.color = '#ff5555';
    else document.getElementById('btn-gamemode').style.color = 'white';
}

const worldTypes = ['default', 'flat'];
const typeNames = { default: "По умолчанию", flat: "Суперплоский" };
let currentTypeIndex = 0;
function cycleWorldType() {
    currentTypeIndex = (currentTypeIndex + 1) % worldTypes.length;
    let type = worldTypes[currentTypeIndex];
    document.getElementById('btn-worldtype').innerText = "Тип мира: " + typeNames[type];
}

function createAndStartWorld() {
    const seedInput = document.getElementById('seed-input').value;
    gameConfig.seed = seedInput ? hashCode(seedInput) : Math.floor(Math.random() * 100000);
    gameConfig.mode = gameModes[currentModeIndex];
    gameConfig.type = worldTypes[currentTypeIndex];

    let modeLabel = gameConfig.mode.charAt(0).toUpperCase() + gameConfig.mode.slice(1);
    document.getElementById('debug-mode').innerText = modeLabel;
    if(gameConfig.mode === 'hardcore') document.getElementById('debug-mode').style.color = 'red';
    else document.getElementById('debug-mode').style.color = 'white';

    startGame();
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function startGame() {
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if(isMobile || window.innerWidth < 800) document.getElementById('mobile-controls').style.display = 'block';

    if (!isGameInitialized) {
        initGame();
        initControls();
        isGameInitialized = true;
    } else {
        resetWorld();
    }
    isGameRunning = true;
    if(!isMobile) { try { document.body.requestPointerLock(); } catch(e) {} }
}

function exitGame() { if(confirm("Закрыть окно?")) window.close(); }
function toggleSetting(key) { alert("Setting " + key); }
function setLanguage(lang) { alert("Lang: " + lang); }

/* ==========================================
   ИГРОВОЙ ДВИЖОК
   ========================================== */

function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 15, 60);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; 

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    inventory = new Inventory();
    raycaster = new THREE.Raycaster();
    raycaster.far = gameConfig.mode === 'creative' ? 8 : 5; 

    // Инициализация шума
    simplex = new SimplexNoise();

    generateChunk();
    animate();
}

function resetWorld() {
    for (let mesh of terrainMeshes) {
        scene.remove(mesh);
        if(mesh.geometry) mesh.geometry.dispose();
        if(mesh.material) mesh.material.dispose();
    }
    terrainMeshes = [];
    generateChunk();
}

// Улучшенная функция шума с Октавами (Fractal Noise)
function getNoise(x, z) {
    if (gameConfig.type === 'flat') return 4;
    
    // Октава 1: Большие горы и равнины (низкая частота)
    let n1 = simplex.noise2D((x + gameConfig.seed) / 50, (z + gameConfig.seed) / 50);
    // Октава 2: Мелкие детали (высокая частота)
    let n2 = simplex.noise2D((x + gameConfig.seed) / 20, (z + gameConfig.seed) / 20);
    
    // Смешивание: Большой шум * 10 блоков + Мелкий шум * 4 блока
    let height = (n1 * 10) + (n2 * 4);
    
    // Поднимаем уровень земли, чтобы не было отрицательных значений часто
    return Math.floor(height + 10); 
}

function createBlock(x, y, z, color, type) {
    // Используем один geometry для всех (можно оптимизировать InstancedMesh, но пока так)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z);
    cube.userData = { type: type };
    scene.add(cube);
    terrainMeshes.push(cube);
}

function generateTree(x, y, z) {
    // Ствол
    for (let i = 0; i < 4; i++) {
        createBlock(x, y + i + 1, z, 0xA0522D, 'wood');
    }
    // Листва
    for (let lx = x - 2; lx <= x + 2; lx++) {
        for (let lz = z - 2; lz <= z + 2; lz++) {
            for (let ly = y + 3; ly <= y + 4; ly++) {
                if (Math.abs(lx - x) === 2 && Math.abs(lz - z) === 2 && Math.random() > 0.5) continue; // Скругляем углы
                createBlock(lx, ly, lz, 0x228B22, 'leaves');
            }
        }
    }
    // Верхушка листвы
    for (let lx = x - 1; lx <= x + 1; lx++) {
        for (let lz = z - 1; lz <= z + 1; lz++) {
            createBlock(lx, y + 5, lz, 0x228B22, 'leaves');
        }
    }
}

function generateChunk() {
    const size = 40; // Размер мира (40x40 блоков)
    const waterLevel = 5; // Уровень моря

    // Стартовая позиция
    camera.position.set(size/2, 20, size/2);

    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            let height = getNoise(x, z);
            
            // Если суперплоский, высота фиксирована
            if (gameConfig.type === 'flat') height = 4;

            // Заполняем столбцы (оптимизация: не рисуем всё до дна, только верхние слои)
            // Но чтобы физика работала корректно, лучше иметь хотя бы 2-3 слоя блоков под ногами
            
            // Определяем тип поверхности
            let surfaceColor = 0x567d46; // Трава
            let surfaceType = 'grass';
            
            // БИОМЫ
            if (gameConfig.type !== 'flat') {
                if (height <= waterLevel + 1) { // Песок у воды
                    surfaceColor = 0xF4A460;
                    surfaceType = 'sand';
                }
                if (height > 18) { // Снежные горы
                    surfaceColor = 0xFFFFFF;
                    surfaceType = 'snow';
                }
            }

            // Рисуем блоки земли/камня
            // Отрисуем от дна (или от глубины -5) до поверхности
            let startY = Math.max(-5, height - 3); 
            
            // Бедрок на дне (визуально на -5)
            if (gameConfig.type === 'flat') startY = 0;

            for (let y = startY; y <= height; y++) {
                let color;
                let type;

                if (y === height) {
                    color = surfaceColor;
                    type = surfaceType;
                } else if (y > height - 3) {
                    color = 0x795548; // Земля
                    type = 'dirt';
                } else {
                    color = 0x808080; // Камень
                    type = 'stone';
                }
                
                // В суперплоском на 0 бедрок
                if (gameConfig.type === 'flat' && y === 0) {
                    color = 0x111111;
                    type = 'bedrock';
                }

                createBlock(x, y, z, color, type);
            }

            // ВОДА
            if (gameConfig.type !== 'flat') {
                for (let wy = height + 1; wy <= waterLevel; wy++) {
                    // Полупрозрачная вода
                    const wGeo = new THREE.BoxGeometry(1, 1, 1);
                    const wMat = new THREE.MeshLambertMaterial({ color: 0x0000FF, transparent: true, opacity: 0.6 });
                    const water = new THREE.Mesh(wGeo, wMat);
                    water.position.set(x, wy, z);
                    water.userData = { type: 'water' };
                    scene.add(water);
                    // Воду не добавляем в terrainMeshes, чтобы сквозь нее проходить, 
                    // но тогда нельзя на нее ставить блоки.
                    // Добавим в отдельный массив или сделаем так:
                    terrainMeshes.push(water); 
                }
            }

            // ДЕРЕВЬЯ
            // Шанс появления дерева (только на траве и не в воде)
            if (gameConfig.type !== 'flat' && surfaceType === 'grass' && height > waterLevel && Math.random() < 0.02) {
                // Чтобы деревья не слипались, можно проверять соседей, но пока рандом
                // Пропускаем края карты
                if (x > 2 && x < size - 2 && z > 2 && z < size - 2) {
                    generateTree(x, height, z);
                }
            }
        }
    }
    
    // Бедрок пол для плоского мира
    if (gameConfig.type === 'flat') {
        // Мы уже нарисовали слои в цикле
    }
}

// ЛОГИКА
function getIntersection() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(terrainMeshes);
    // Игнорируем воду для "ломания", если хотим ломать дно. Но пока сделаем, что воду ломать можно (убирать)
    return intersects.length > 0 ? intersects[0] : null;
}

function breakBlock() {
    const intersect = getIntersection();
    if (intersect) {
        if (intersect.object.userData.type === 'bedrock' && gameConfig.mode !== 'creative') return;
        scene.remove(intersect.object);
        terrainMeshes.splice(terrainMeshes.indexOf(intersect.object), 1);
        if(intersect.object.geometry) intersect.object.geometry.dispose();
        if(intersect.object.material) intersect.object.material.dispose();
    }
}

function placeBlock() {
    const intersect = getIntersection();
    if (intersect) {
        const voxelId = intersect.object.position.clone().add(intersect.face.normal);
        // Коллизия с игроком
        const p = camera.position;
        // Если блок ставится прямо в игрока - не ставим
        if (Math.abs(p.x - voxelId.x) < 0.8 && Math.abs(p.y - voxelId.y) < 1.8 && Math.abs(p.z - voxelId.z) < 0.8) return;

        const blockData = inventory.getSelectedBlock();
        createBlock(voxelId.x, voxelId.y, voxelId.z, blockData.color, 'placed');
    }
}

// УЛУЧШЕННАЯ ФИЗИКА
function updatePhysics() {
    if (gameConfig.mode === 'creative') return;

    // Гравитация
    let x = Math.round(camera.position.x);
    let z = Math.round(camera.position.z);
    
    // Ищем высоту блока под ногами игрока
    // Проходим по массиву мешей. Это не очень эффективно, но работает.
    // Оптимизация: искать только в столбце x, z
    let groundHeight = -100;
    
    // Простой алгоритм: найти максимальный Y среди блоков, у которых x, z совпадают с игроком
    // и которые находятся НИЖЕ игрока
    
    // Для оптимизации: если мы не двигаемся, не пересчитывать. Но пока считаем всегда.
    
    // Вариант 2: Raycaster вниз
    const rayDown = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0), 0, 10);
    const intersects = rayDown.intersectObjects(terrainMeshes);
    
    let onGround = false;
    
    if (intersects.length > 0) {
        // Расстояние до земли
        const dist = intersects[0].distance;
        // Высота глаз игрока ~1.6. Если dist < 1.6, мы на земле
        if (dist <= 1.7) {
            onGround = true;
            camera.position.y = intersects[0].point.y + 1.7;
        }
    }

    // Если не на земле - падаем
    // Упрощенная эмуляция velocity
    if (!onGround) {
        camera.position.y -= 0.15; // Сила тяжести
    }

    // Смерть
    if (camera.position.y < -15) {
        if(gameConfig.mode === 'hardcore') {
            alert("GAME OVER!");
            showScreen('main-menu');
        } else {
            camera.position.set(20, 20, 20); // Респаун
        }
    }
}

function initControls() {
    const onKey = (e, state) => {
        if(e.code === 'KeyW') moveState.forward = state;
        if(e.code === 'KeyS') moveState.backward = state;
        if(e.code === 'KeyA') moveState.left = state;
        if(e.code === 'KeyD') moveState.right = state;
        if(e.code === 'Space') moveState.up = state;
        if(e.code === 'ShiftLeft') moveState.down = state;
        if(state && e.key >= 1 && e.key <= 9) inventory.selectSlot(parseInt(e.key) - 1);
    };
    document.addEventListener('keydown', e => onKey(e, true));
    document.addEventListener('keyup', e => onKey(e, false));

    document.addEventListener('mousedown', (e) => {
        if (!isGameRunning || e.target.classList.contains('hotbar-slot')) return;
        if (document.pointerLockElement === document.body) {
            if (e.button === 0) breakBlock();
            if (e.button === 2) placeBlock();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isGameRunning || document.pointerLockElement !== document.body) return;
        camera.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
    });

    const bindBtn = (id, key) => {
        const btn = document.getElementById(id); if(!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveState[key] = false; });
    };
    bindBtn('btn-fwd', 'forward'); bindBtn('btn-back', 'backward'); bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right');
    bindBtn('btn-jump', 'up'); bindBtn('btn-shift', 'down');
    document.getElementById('btn-break').addEventListener('touchstart', (e) => { e.preventDefault(); breakBlock(); });
    document.getElementById('btn-place').addEventListener('touchstart', (e) => { e.preventDefault(); placeBlock(); });
    
    let lastX = 0, lastY = 0;
    document.addEventListener('touchstart', (e) => {
        if(!e.target.classList.contains('control-btn') && !e.target.classList.contains('hotbar-slot') && !e.target.classList.contains('input-field')) {
            lastX = e.touches[0].pageX; lastY = e.touches[0].pageY;
        }
    }, {passive: false});

    document.addEventListener('touchmove', (e) => {
        if (!isGameRunning || e.target.classList.contains('control-btn')) return;
        const dx = e.touches[0].pageX - lastX;
        const dy = e.touches[0].pageY - lastY;
        camera.rotation.y -= dx * 0.005;
        camera.rotation.x -= dy * 0.005;
        camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
        lastX = e.touches[0].pageX; lastY = e.touches[0].pageY;
    }, {passive: false});
}

function animate() {
    requestAnimationFrame(animate);
    if (isGameRunning) {
        updatePhysics();
        const speed = 0.15;
        const angle = camera.rotation.y;
        if (moveState.forward) { camera.position.x -= Math.sin(angle)*speed; camera.position.z -= Math.cos(angle)*speed; }
        if (moveState.backward) { camera.position.x += Math.sin(angle)*speed; camera.position.z += Math.cos(angle)*speed; }
        if (moveState.left) { camera.position.x -= Math.sin(angle+Math.PI/2)*speed; camera.position.z -= Math.cos(angle+Math.PI/2)*speed; }
        if (moveState.right) { camera.position.x += Math.sin(angle+Math.PI/2)*speed; camera.position.z += Math.cos(angle+Math.PI/2)*speed; }
        
        if (gameConfig.mode === 'creative') {
            if (moveState.up) camera.position.y += speed;
            if (moveState.down) camera.position.y -= speed;
        } else {
            // Прыжок в выживании (если мы на земле - проверяется в updatePhysics, но для простоты здесь):
            // Для реального прыжка нужно менять скорость (velocity.y), здесь просто двигаем вверх, 
            // а физика потом опустит, если мы в воздухе.
            if (moveState.up) camera.position.y += 0.25; 
        }

        const p = camera.position;
        document.getElementById('xyz-pos').innerText = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    if(renderer && scene) renderer.render(scene, camera);
}