/* ==========================================
   ПЕРЕМЕННЫЕ
   ========================================== */
let scene, camera, renderer, raycaster;
let inventory;
let terrainMeshes = [];
let isGameInitialized = false;
let isGameRunning = false;
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
let worldSeed = Math.random() * 1000; // Случайный сид по умолчанию

const translations = {
    ru: { singleplayer: "Одиночная игра", multiplayer: "Сетевая игра", settings: "Настройки", language: "Язык", quit: "Выйти", select_world: "Выбор мира", play_world: "Играть", cancel: "Отмена", done: "Готово", fov_prefix: "Поле зрения: ", render_prefix: "Прорисовка: ", music_prefix: "Музыка: " },
    en: { singleplayer: "Singleplayer", multiplayer: "Multiplayer", settings: "Settings", language: "Language", quit: "Quit Game", select_world: "Select World", play_world: "Play", cancel: "Cancel", done: "Done", fov_prefix: "FOV: ", render_prefix: "Render Dist: ", music_prefix: "Music: " }
};

let currentLang = 'ru';
let gameSettings = { fov: 75, renderDist: 8, music: false };

const splashes = ["New Layers!", "Iron Ore found!", "Procedural Generation!", "Infinite possibilities!"];
document.getElementById('splash-text').innerText = splashes[Math.floor(Math.random() * splashes.length)];

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

function startGame() {
    // Генерируем новый сид при каждом запуске для "ИИ" эффекта
    worldSeed = Math.floor(Math.random() * 100000); 
    document.getElementById('seed-display').innerText = worldSeed;

    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if(isMobile || window.innerWidth < 800) document.getElementById('mobile-controls').style.display = 'block';

    if (!isGameInitialized) {
        initGame();
        initControls();
        isGameInitialized = true;
    } else {
        // Если игра уже была инициализирована, перегенерируем мир
        resetWorld();
    }
    
    isGameRunning = true;
    if(!isMobile) { try { document.body.requestPointerLock(); } catch(e) {} }
}

function exitGame() { if(confirm("Закрыть окно?")) window.close(); }

// Настройки
function toggleSetting(key) {
    if (key === 'fov') gameSettings.fov = gameSettings.fov === 75 ? 90 : (gameSettings.fov === 90 ? 110 : 75);
    else if (key === 'render') gameSettings.renderDist = gameSettings.renderDist === 8 ? 16 : (gameSettings.renderDist === 16 ? 4 : 8);
    else if (key === 'music') gameSettings.music = !gameSettings.music;
    updateSettingsButtons();
    if(camera) { camera.fov = gameSettings.fov; camera.updateProjectionMatrix(); }
}

function updateSettingsButtons() {
    const t = translations[currentLang];
    document.getElementById('btn-fov').innerText = t.fov_prefix + gameSettings.fov;
    document.getElementById('btn-render').innerText = t.render_prefix + gameSettings.renderDist;
    document.getElementById('btn-music').innerText = t.music_prefix + (gameSettings.music ? "ON" : "OFF");
}

function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[currentLang][key]) el.innerText = translations[currentLang][key];
    });
    updateSettingsButtons();
}

/* ==========================================
   ИГРОВОЙ ДВИЖОК
   ========================================== */

function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; 

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    inventory = new Inventory();
    raycaster = new THREE.Raycaster();
    raycaster.far = 6; 

    generateChunk(); // Первая генерация
    animate();
    updateSettingsButtons();
    setLanguage('ru');
}

function resetWorld() {
    // Удаляем старые блоки
    for (let mesh of terrainMeshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
    terrainMeshes = [];
    generateChunk();
}

function generateChunk() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const simplex = new SimplexNoise();
    
    // Определяем материалы
    const matGrass = new THREE.MeshLambertMaterial({ color: 0x567d46 }); // Трава
    const matDirt = new THREE.MeshLambertMaterial({ color: 0x795548 });  // Земля
    const matStone = new THREE.MeshLambertMaterial({ color: 0x808080 }); // Камень
    const matIron = new THREE.MeshLambertMaterial({ color: 0xD2B48C });  // Руда (песочный цвет)
    const matBedrock = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Бедрок (почти черный)

    // Размер чанка. 16x16 оптимально для JS без оптимизаций
    const size = 16; 
    
    // Ставим камеру в центр
    camera.position.set(size/2, 12, size/2);

    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            // ИИ ГЕНЕРАЦИЯ: Используем Seed для смещения шума
            // (x + worldSeed) гарантирует уникальность ландшафта
            let value = simplex.noise2D((x + worldSeed) / 20, (z + worldSeed) / 20); 
            
            // Высота от 6 до 12 блоков
            let height = Math.floor(value * 4) + 8; 

            // Генерируем столбец блоков снизу вверх
            for (let y = 0; y <= height; y++) {
                let material;

                if (y === 0) {
                    // Самый низ - Бедрок
                    material = matBedrock;
                } else if (y === height) {
                    // Самый верх - Трава
                    material = matGrass;
                } else if (y > height - 3) {
                    // 2 блока под травой - Земля
                    material = matDirt;
                } else {
                    // Всё остальное - Камень
                    // С шансом 10% генерируем железную руду внутри камня
                    if (Math.random() < 0.10) {
                        material = matIron;
                    } else {
                        material = matStone;
                    }
                }

                // Оптимизация: не рисуем блоки, которые полностью скрыты (внутри горы)
                // Рисуем, если блок на границе чанка ИЛИ блок сверху прозрачен (не дошли до верха)
                // Для простоты реализации копания (чтобы внутри не было пустоты) сейчас рисуем ВСЕ блоки.
                // Чтобы было не так лагуче, чанк небольшой (16x16).
                
                const cube = new THREE.Mesh(geometry, material);
                cube.position.set(x, y, z);
                // Сохраняем имя типа блока в данные, чтобы знать что это
                cube.userData = { type: y === 0 ? 'bedrock' : 'other' };
                
                scene.add(cube);
                terrainMeshes.push(cube);
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
        // Нельзя ломать бедрок
        if (intersect.object.userData.type === 'bedrock') return;

        scene.remove(intersect.object);
        terrainMeshes.splice(terrainMeshes.indexOf(intersect.object), 1);
        intersect.object.geometry.dispose();
        intersect.object.material.dispose();
    }
}

function placeBlock() {
    const intersect = getIntersection();
    if (intersect) {
        const voxelId = intersect.object.position.clone().add(intersect.face.normal);
        const p = camera.position;
        // Коллизия с игроком
        if (Math.abs(p.x - voxelId.x) < 0.8 && Math.abs(p.y - voxelId.y) < 1.8 && Math.abs(p.z - voxelId.z) < 0.8) return;

        const blockData = inventory.getSelectedBlock();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: blockData.color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(voxelId);
        cube.userData = { type: 'placed' }; // Поставленные блоки можно ломать
        
        scene.add(cube);
        terrainMeshes.push(cube);
    }
}

function initControls() {
    document.addEventListener('keydown', (e) => {
        if(e.code === 'KeyW') moveState.forward = true;
        if(e.code === 'KeyS') moveState.backward = true;
        if(e.code === 'KeyA') moveState.left = true;
        if(e.code === 'KeyD') moveState.right = true;
        if(e.code === 'Space') moveState.up = true;
        if(e.code === 'ShiftLeft') moveState.down = true;
        if(e.key >= 1 && e.key <= 9) inventory.selectSlot(parseInt(e.key) - 1);
    });
    
    document.addEventListener('keyup', (e) => {
        if(e.code === 'KeyW') moveState.forward = false;
        if(e.code === 'KeyS') moveState.backward = false;
        if(e.code === 'KeyA') moveState.left = false;
        if(e.code === 'KeyD') moveState.right = false;
        if(e.code === 'Space') moveState.up = false;
        if(e.code === 'ShiftLeft') moveState.down = false;
    });

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
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); moveState[key] = false; });
    };
    bindBtn('btn-fwd', 'forward'); bindBtn('btn-back', 'backward');
    bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right');
    bindBtn('btn-up', 'up'); bindBtn('btn-down', 'down');

    document.getElementById('btn-break').addEventListener('touchstart', (e) => { e.preventDefault(); breakBlock(); });
    document.getElementById('btn-place').addEventListener('touchstart', (e) => { e.preventDefault(); placeBlock(); });

    let lastX = 0, lastY = 0;
    document.addEventListener('touchstart', (e) => {
        if(!e.target.classList.contains('control-btn') && !e.target.classList.contains('hotbar-slot')) {
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
        const speed = 0.15;
        const angle = camera.rotation.y;
        if (moveState.forward) { camera.position.x -= Math.sin(angle)*speed; camera.position.z -= Math.cos(angle)*speed; }
        if (moveState.backward) { camera.position.x += Math.sin(angle)*speed; camera.position.z += Math.cos(angle)*speed; }
        if (moveState.left) { camera.position.x -= Math.sin(angle+Math.PI/2)*speed; camera.position.z -= Math.cos(angle+Math.PI/2)*speed; }
        if (moveState.right) { camera.position.x += Math.sin(angle+Math.PI/2)*speed; camera.position.z += Math.cos(angle+Math.PI/2)*speed; }
        if (moveState.up) camera.position.y += speed;
        if (moveState.down) camera.position.y -= speed;
        
        const p = camera.position;
        document.getElementById('debug-info').innerHTML = `Seed: ${worldSeed} <br> XYZ: ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    if(renderer && scene) renderer.render(scene, camera);
}