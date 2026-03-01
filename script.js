/* ==========================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
   ========================================== */
let scene, camera, renderer, raycaster;
let inventory;
let terrainMeshes = [];
let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

// Игрок
let playerStats = { health: 20, food: 20 };
let handMesh;
let isSwinging = false;
let swingProgress = 0;

let gameConfig = { seed: 12345, mode: 'creative', type: 'default' };
const translations = { ru: {}, en: {} }; // (Оставим пустым для краткости, старый код работает)
let currentLang = 'ru';
let gameSettings = { fov: 75, renderDist: 8, music: false };
let simplex;
let textureLoader;
let blockMaterials = {}; // Кеш материалов

document.getElementById('splash-text').innerText = "Realistic Hand!";

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
    survival: "20HP, Голод, Крафт. Инвентарь пуст.",
    hardcore: "1 жизнь. Инвентарь пуст.",
    creative: "Полет, все блоки."
};
let currentModeIndex = 0;

function cycleGameMode() {
    currentModeIndex = (currentModeIndex + 1) % gameModes.length;
    let mode = gameModes[currentModeIndex];
    document.getElementById('btn-gamemode').innerText = "Режим: " + modeNames[mode];
    document.getElementById('gamemode-desc').innerText = modeDescs[mode];
    document.getElementById('btn-gamemode').style.color = mode === 'hardcore' ? '#ff5555' : 'white';
}

const worldTypes = ['default', 'flat'];
const typeNames = { default: "По умолчанию", flat: "Суперплоский" };
let currentTypeIndex = 0;
function cycleWorldType() {
    currentTypeIndex = (currentTypeIndex + 1) % worldTypes.length;
    document.getElementById('btn-worldtype').innerText = "Тип мира: " + typeNames[worldTypes[currentTypeIndex]];
}

function createAndStartWorld() {
    const seedInput = document.getElementById('seed-input').value;
    gameConfig.seed = seedInput ? hashCode(seedInput) : Math.floor(Math.random() * 100000);
    gameConfig.mode = gameModes[currentModeIndex];
    gameConfig.type = worldTypes[currentTypeIndex];

    let modeLabel = gameConfig.mode.charAt(0).toUpperCase() + gameConfig.mode.slice(1);
    document.getElementById('debug-mode').innerText = modeLabel;
    document.getElementById('debug-mode').style.color = gameConfig.mode === 'hardcore' ? 'red' : 'white';

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
    
    // Сброс статов при новой игре
    playerStats.health = 20;
    playerStats.food = 20;
    updateStatsUI();

    // Показываем/скрываем статы в зависимости от режима
    if (gameConfig.mode === 'creative') {
        document.getElementById('stats-container').style.display = 'none';
    } else {
        document.getElementById('stats-container').style.display = 'flex';
    }
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if(isMobile || window.innerWidth < 800) document.getElementById('mobile-controls').style.display = 'block';

    if (!isGameInitialized) {
        initGame();
        initControls();
        isGameInitialized = true;
    } else {
        resetWorld();
    }
    
    // Настройка инвентаря под режим
    inventory.setMode(gameConfig.mode);

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
    // Для пиксельных текстур
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    inventory = new Inventory();
    raycaster = new THREE.Raycaster();
    raycaster.far = 6; 
    simplex = new SimplexNoise();
    textureLoader = new THREE.TextureLoader();

    loadMaterials(); // Загрузка текстур
    initHand();      // Создание руки
    generateChunk(); // Генерация
    animate();
}

function loadMaterials() {
    // Функция помощник для загрузки с фильтрацией Nearest (пиксельной)
    const loadTex = (url) => {
        const tex = textureLoader.load(url);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return tex;
    };

    // Определяем материалы для блоков
    // Трава (многосторонняя)
    const grassTop = loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass.png');
    const grassSide = loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/grass_dirt.png');
    const dirtTex = loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/dirt.png');
    
    blockMaterials['grass'] = [
        new THREE.MeshLambertMaterial({ map: grassSide }), // Right
        new THREE.MeshLambertMaterial({ map: grassSide }), // Left
        new THREE.MeshLambertMaterial({ map: grassTop }),  // Top
        new THREE.MeshLambertMaterial({ map: dirtTex }),   // Bottom
        new THREE.MeshLambertMaterial({ map: grassSide }), // Front
        new THREE.MeshLambertMaterial({ map: grassSide })  // Back
    ];

    blockMaterials['dirt'] = new THREE.MeshLambertMaterial({ map: dirtTex });
    blockMaterials['stone'] = new THREE.MeshLambertMaterial({ map: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/cobblestone.png') });
    blockMaterials['wood'] = new THREE.MeshLambertMaterial({ map: loadTex('https://raw.githubusercontent.com/joshwcomeau/react-three-fiber-minecraft/master/public/textures/wood.jpg') });
    blockMaterials['leaves'] = new THREE.MeshLambertMaterial({ map: grassSide, color: 0x228B22 }); // Хак с цветом для листвы
    blockMaterials['sand'] = new THREE.MeshLambertMaterial({ map: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/sand.png') });
    blockMaterials['glass'] = new THREE.MeshLambertMaterial({ map: loadTex('https://raw.githubusercontent.com/joshwcomeau/react-three-fiber-minecraft/master/public/textures/glass.png'), transparent: true });
    blockMaterials['brick'] = new THREE.MeshLambertMaterial({ map: loadTex('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/minecraft/brick.png') });
    blockMaterials['obsidian'] = new THREE.MeshLambertMaterial({ map: loadTex('https://raw.githubusercontent.com/joshwcomeau/react-three-fiber-minecraft/master/public/textures/obsidian.jpg') });
    blockMaterials['bedrock'] = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Текстуры нет под рукой, будет черный
    blockMaterials['snow'] = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
}

function initHand() {
    // Создаем руку (прямоугольник)
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    // Текстура кожи или рукава (пока просто цвет)
    const material = new THREE.MeshLambertMaterial({ color: 0xCCAA88 }); // Цвет кожи
    handMesh = new THREE.Mesh(geometry, material);
    
    // Прикрепляем руку к камере, чтобы она двигалась за взглядом
    handMesh.position.set(0.3, -0.3, -0.5); // Справа снизу
    handMesh.rotation.set(0.2, -0.2, 0);
    camera.add(handMesh);
    // Камеру уже добавили в initGame, но теперь в scene нужно добавить камеру (чтобы дети рендерились)
    scene.add(camera);
}

function swingHandAnimation() {
    if (!isSwinging) return;

    const speed = 0.3;
    swingProgress += speed;

    // Простая анимация удара (поворот)
    handMesh.rotation.x = 0.2 + Math.sin(swingProgress) * 0.5;
    handMesh.position.z = -0.5 - Math.sin(swingProgress) * 0.2;

    if (swingProgress >= Math.PI) {
        isSwinging = false;
        swingProgress = 0;
        handMesh.rotation.x = 0.2; // Сброс
        handMesh.position.z = -0.5;
    }
}

function updateStatsUI() {
    // Здоровье (1 сердце = 2 HP)
    const healthContainer = document.getElementById('health-bar');
    healthContainer.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const heart = document.createElement('div');
        heart.className = 'stat-icon heart';
        if (playerStats.health <= i * 2) {
            heart.classList.add('empty');
        } else if (playerStats.health === i * 2 + 1) {
            heart.classList.add('half');
        }
        healthContainer.appendChild(heart);
    }

    // Еда (1 ножка = 2 Food)
    const foodContainer = document.getElementById('food-bar');
    foodContainer.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const food = document.createElement('div');
        food.className = 'stat-icon food';
        if (playerStats.food <= i * 2) {
            food.classList.add('empty');
        }
        foodContainer.appendChild(food);
    }
}

function resetWorld() {
    for (let mesh of terrainMeshes) {
        scene.remove(mesh);
        if(mesh.geometry) mesh.geometry.dispose();
    }
    terrainMeshes = [];
    generateChunk();
}

function getNoise(x, z) {
    if (gameConfig.type === 'flat') return 4;
    let n1 = simplex.noise2D((x + gameConfig.seed) / 50, (z + gameConfig.seed) / 50);
    let n2 = simplex.noise2D((x + gameConfig.seed) / 20, (z + gameConfig.seed) / 20);
    let height = (n1 * 10) + (n2 * 4);
    return Math.floor(height + 10); 
}

function createBlock(x, y, z, type) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    let material = blockMaterials[type] || blockMaterials['dirt'];
    
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z);
    cube.userData = { type: type };
    scene.add(cube);
    terrainMeshes.push(cube);
}

function generateChunk() {
    const size = 30; // Чуть меньше, чтобы текстуры прогрузились быстрее
    const waterLevel = 5;
    camera.position.set(size/2, 20, size/2);

    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            let height = getNoise(x, z);
            if (gameConfig.type === 'flat') height = 4;
            let surfaceType = 'grass';
            
            if (gameConfig.type !== 'flat') {
                if (height <= waterLevel + 1) surfaceType = 'sand';
                if (height > 18) surfaceType = 'snow';
            }

            let startY = Math.max(-2, height - 3); 
            if (gameConfig.type === 'flat') startY = 0;

            for (let y = startY; y <= height; y++) {
                let type;
                if (y === height) type = surfaceType;
                else if (y > height - 3) type = 'dirt';
                else type = 'stone';
                if (gameConfig.type === 'flat' && y === 0) type = 'bedrock';
                createBlock(x, y, z, type);
            }
            // Вода (без коллизии пока)
            if (gameConfig.type !== 'flat') {
                for (let wy = height + 1; wy <= waterLevel; wy++) {
                     // Создаем воду вручную, т.к. материал специфичный
                    const wGeo = new THREE.BoxGeometry(1, 1, 1);
                    const wMat = new THREE.MeshLambertMaterial({ color: 0x0000FF, transparent: true, opacity: 0.6 });
                    const water = new THREE.Mesh(wGeo, wMat);
                    water.position.set(x, wy, z);
                    scene.add(water);
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
    // Анимация руки
    isSwinging = true;

    const intersect = getIntersection();
    if (intersect) {
        // Проверка дистанции
        if (intersect.distance > 5) return;

        if (intersect.object.userData.type === 'bedrock' && gameConfig.mode !== 'creative') return;
        
        // В выживании добавляем блок в инвентарь (простая реализация)
        if (gameConfig.mode !== 'creative') {
             // Здесь можно добавить логику подбора
        }

        scene.remove(intersect.object);
        terrainMeshes.splice(terrainMeshes.indexOf(intersect.object), 1);
    }
}

function placeBlock() {
    isSwinging = true;
    
    // В выживании проверяем, есть ли блок в руке
    const item = inventory.getSelectedBlock();
    if (!item && gameConfig.mode !== 'creative') return; // Пустая рука

    const intersect = getIntersection();
    if (intersect && intersect.distance < 5) {
        const voxelId = intersect.object.position.clone().add(intersect.face.normal);
        const p = camera.position;
        if (Math.abs(p.x - voxelId.x) < 0.8 && Math.abs(p.y - voxelId.y) < 1.8 && Math.abs(p.z - voxelId.z) < 0.8) return;

        let typeToPlace = item ? item.type : 'dirt'; // Если креатив и пусто, ставим землю (или ничего)
        if (!item && gameConfig.mode === 'creative') typeToPlace = 'wood'; // Дефолт для креатива

        createBlock(voxelId.x, voxelId.y, voxelId.z, typeToPlace);
        
        // В выживании тратим блок (пока не реализовано кол-во, просто слот остается, но можно очистить)
    }
}

function updatePhysics() {
    if (gameConfig.mode === 'creative') return;

    const rayDown = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0), 0, 10);
    const intersects = rayDown.intersectObjects(terrainMeshes);
    let onGround = false;
    
    if (intersects.length > 0) {
        if (intersects[0].distance <= 1.7) {
            onGround = true;
            camera.position.y = intersects[0].point.y + 1.7;
        }
    }
    if (!onGround) camera.position.y -= 0.15;
    if (camera.position.y < -15) {
        if(gameConfig.mode === 'hardcore') {
            alert("GAME OVER!"); showScreen('main-menu');
        } else {
            camera.position.set(20, 20, 20);
            playerStats.health -= 4; // Урон от падения
            updateStatsUI();
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
    // Мобильные эвенты (без изменений)
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
        swingHandAnimation(); // Анимация руки

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
             if (moveState.up) camera.position.y += 0.25; 
        }

        const p = camera.position;
        document.getElementById('xyz-pos').innerText = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    if(renderer && scene) renderer.render(scene, camera);
}