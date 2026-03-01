/* ==========================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
   ========================================== */
let scene, camera, renderer, raycaster;
let inventory;
let terrainMeshes = [];
let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

// КОНФИГУРАЦИЯ МИРА
let gameConfig = {
    seed: 12345,
    mode: 'survival', // 'creative', 'survival', 'hardcore'
    type: 'default'   // 'default', 'flat'
};

const translations = {
    ru: { singleplayer: "Одиночная игра", multiplayer: "Сетевая игра", settings: "Настройки", language: "Язык", quit: "Выйти" },
    en: { singleplayer: "Singleplayer", multiplayer: "Multiplayer", settings: "Settings", language: "Language", quit: "Quit Game" }
};
let currentLang = 'ru';
let gameSettings = { fov: 75, renderDist: 8, music: false };

document.getElementById('splash-text').innerText = ["Game Modes!", "Superflat!", "Physics!", "Hardcore!"][Math.floor(Math.random()*4)];

/* ==========================================
   МЕНЮ И СОЗДАНИЕ МИРА
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

// ЛОГИКА МЕНЮ СОЗДАНИЯ МИРА
const gameModes = ['survival', 'hardcore', 'creative'];
const modeNames = { survival: "Выживание", hardcore: "Хардкор", creative: "Творческий" };
const modeDescs = { 
    survival: "Поиск ресурсов, крафт, уровни, здоровье и голод.",
    hardcore: "То же, что и Выживание, но с одной жизнью (Сложно!).",
    creative: "Неограниченные ресурсы, свободный полет и мгновенное ломание."
};
let currentModeIndex = 0;

function cycleGameMode() {
    currentModeIndex = (currentModeIndex + 1) % gameModes.length;
    let mode = gameModes[currentModeIndex];
    document.getElementById('btn-gamemode').innerText = "Режим: " + modeNames[mode];
    document.getElementById('gamemode-desc').innerText = modeDescs[mode];
    
    // Красный цвет для Хардкора
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
    // 1. Считываем настройки
    const seedInput = document.getElementById('seed-input').value;
    // Если пусто, генерируем случайный, иначе хешируем строку в число
    gameConfig.seed = seedInput ? hashCode(seedInput) : Math.floor(Math.random() * 100000);
    gameConfig.mode = gameModes[currentModeIndex];
    gameConfig.type = worldTypes[currentTypeIndex];

    // 2. Обновляем UI
    let modeLabel = gameConfig.mode.charAt(0).toUpperCase() + gameConfig.mode.slice(1);
    if(gameConfig.mode === 'hardcore') modeLabel = "HARDCORE";
    document.getElementById('debug-mode').innerText = modeLabel;
    if(gameConfig.mode === 'hardcore') document.getElementById('debug-mode').style.color = 'red';
    else document.getElementById('debug-mode').style.color = 'white';

    // 3. Запускаем
    startGame();
}

// Простой хеш для строк
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
function toggleSetting(key) { alert("Setting " + key); } // Заглушка, можно оставить старый код
function setLanguage(lang) { alert("Lang: " + lang); }

/* ==========================================
   ИГРОВОЙ ДВИЖОК
   ========================================== */

function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 60);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; 

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    inventory = new Inventory();
    raycaster = new THREE.Raycaster();
    raycaster.far = gameConfig.mode === 'creative' ? 6 : 4; 

    generateChunk();
    animate();
}

function resetWorld() {
    for (let mesh of terrainMeshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
    terrainMeshes = [];
    generateChunk();
}

// Утилита для получения высоты ландшафта в точке (x, z)
function getTerrainHeight(x, z) {
    if (gameConfig.type === 'flat') return 4; // Плоский мир всегда на высоте 4 (bedrock+dirt+dirt+grass)
    
    // Дублируем логику шума
    const simplex = new SimplexNoise();
    let value = simplex.noise2D((x + gameConfig.seed) / 20, (z + gameConfig.seed) / 20);
    return Math.floor(value * 4) + 8;
}

function generateChunk() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Материалы
    const matGrass = new THREE.MeshLambertMaterial({ color: 0x567d46 });
    const matDirt = new THREE.MeshLambertMaterial({ color: 0x795548 });
    const matStone = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const matBedrock = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const size = 20; 
    
    // Установка позиции игрока
    if (gameConfig.type === 'flat') camera.position.set(size/2, 6, size/2);
    else camera.position.set(size/2, 15, size/2);

    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            let height;
            
            // ГЕНЕРАЦИЯ В ЗАВИСИМОСТИ ОТ ТИПА
            if (gameConfig.type === 'flat') {
                height = 3; // 0, 1, 2, 3 (4 слоя)
            } else {
                height = getTerrainHeight(x, z);
            }

            for (let y = 0; y <= height; y++) {
                let material;
                
                // Слои для плоского мира
                if (gameConfig.type === 'flat') {
                    if (y === 0) material = matBedrock;
                    else if (y < 3) material = matDirt;
                    else material = matGrass;
                } 
                // Слои для обычного мира
                else {
                    if (y === 0) material = matBedrock;
                    else if (y === height) material = matGrass;
                    else if (y > height - 3) material = matDirt;
                    else material = matStone;
                }

                // Визуальная оптимизация (не рисуем внутренности)
                // Для простоты здесь рисуем все, кроме совсем глубоких
                if (y === height || x===0 || x===size-1 || z===0 || z===size-1 || y > height-2) {
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(x, y, z);
                    cube.userData = { type: y===0 ? 'bedrock' : 'block' };
                    scene.add(cube);
                    terrainMeshes.push(cube);
                }
            }
        }
    }
}

// ЛОГИКА
function getIntersection() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(terrainMeshes);
    return intersects.length > 0 ? intersects[0] : null;
}

function breakBlock() {
    const intersect = getIntersection();
    if (intersect) {
        if (intersect.object.userData.type === 'bedrock' && gameConfig.mode !== 'creative') return; // Бедрок не ломается в выживании
        scene.remove(intersect.object);
        terrainMeshes.splice(terrainMeshes.indexOf(intersect.object), 1);
    }
}

function placeBlock() {
    const intersect = getIntersection();
    if (intersect) {
        const voxelId = intersect.object.position.clone().add(intersect.face.normal);
        // Коллизия с игроком
        const p = camera.position;
        if (Math.abs(p.x - voxelId.x) < 0.8 && Math.abs(p.y - voxelId.y) < 1.8 && Math.abs(p.z - voxelId.z) < 0.8) return;

        const blockData = inventory.getSelectedBlock();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: blockData.color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(voxelId);
        cube.userData = { type: 'placed' };
        scene.add(cube);
        terrainMeshes.push(cube);
    }
}

// ФИЗИКА И ДВИЖЕНИЕ
function updatePhysics() {
    // В Творческом режиме физика отключена (полет)
    if (gameConfig.mode === 'creative') return;

    // Простая гравитация для Выживания/Хардкора
    // Находим высоту земли под игроком
    let x = Math.round(camera.position.x);
    let z = Math.round(camera.position.z);
    
    // Поиск высоты в данной точке. 
    // В идеале нужен Raycast вниз, но для оптимизации берем из формулы генерации или ищем в массиве мешей
    // Используем упрощение: ищем максимальный Y в terrainMeshes по координатам X, Z
    let groundY = -1;
    
    // Простой поиск (медленно для больших миров, но ок для демки)
    // Лучше использовать карту высот, но здесь пробежимся по блокам рядом
    for(let m of terrainMeshes) {
        if(Math.round(m.position.x) === x && Math.round(m.position.z) === z) {
            if(m.position.y > groundY) groundY = m.position.y;
        }
    }

    // Желаемая высота (уровень глаз = +1.6 над блоком)
    let targetY = groundY + 2.5; // +2.5 чтобы стоять на блоке (центр блока + пол блока + рост)

    // Если мы выше земли - падаем
    if (camera.position.y > targetY) {
        camera.position.y -= 0.15; // Скорость падения
    } 
    // Если упали сквозь землю - поднимаем
    else if (camera.position.y < targetY - 0.5) {
        camera.position.y = targetY;
    }
    
    // Смерть в пустоте (Хардкор/Выживание)
    if (camera.position.y < -10) {
        if(gameConfig.mode === 'hardcore') {
            alert("GAME OVER! Hardcore mode.");
            showScreen('main-menu');
        } else {
            // Респаун
            camera.position.y = 20;
            camera.position.x = 10;
            camera.position.z = 10;
        }
    }
}

function initControls() {
    // WASD и прочее (стандарт)
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

    // Мобильные
    const bindBtn = (id, key) => {
        const btn = document.getElementById(id); if(!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveState[key] = false; });
    };
    bindBtn('btn-fwd', 'forward'); bindBtn('btn-back', 'backward'); bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right');
    bindBtn('btn-jump', 'up'); bindBtn('btn-shift', 'down');
    document.getElementById('btn-break').addEventListener('touchstart', (e) => { e.preventDefault(); breakBlock(); });
    document.getElementById('btn-place').addEventListener('touchstart', (e) => { e.preventDefault(); placeBlock(); });
    
    // Свайп камеры
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
        // Физика (гравитация)
        updatePhysics();

        const speed = 0.15;
        const angle = camera.rotation.y;
        if (moveState.forward) { camera.position.x -= Math.sin(angle)*speed; camera.position.z -= Math.cos(angle)*speed; }
        if (moveState.backward) { camera.position.x += Math.sin(angle)*speed; camera.position.z += Math.cos(angle)*speed; }
        if (moveState.left) { camera.position.x -= Math.sin(angle+Math.PI/2)*speed; camera.position.z -= Math.cos(angle+Math.PI/2)*speed; }
        if (moveState.right) { camera.position.x += Math.sin(angle+Math.PI/2)*speed; camera.position.z += Math.cos(angle+Math.PI/2)*speed; }
        
        // Полет вверх/вниз только в креативе
        if (gameConfig.mode === 'creative') {
            if (moveState.up) camera.position.y += speed;
            if (moveState.down) camera.position.y -= speed;
        } else {
            // В выживании прыжок можно реализовать через импульс, пока просто "телепорт" вверх если есть коллизия
            if (moveState.up && camera.position.y < 100) { // Простейший прыжок
                 // camera.position.y += 0.3; // Нужна нормальная физика velocity
            }
        }

        const p = camera.position;
        document.getElementById('xyz-pos').innerText = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    if(renderer && scene) renderer.render(scene, camera);
}