/* ==========================================
   ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
   ========================================== */
let scene, camera, renderer, raycaster;
let inventory;
let isGameInitialized = false;
let isGameRunning = false;
let isPaused = false; 
let moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

let playerStats = { health: 20, food: 20 };
let velocity = new THREE.Vector3(0, 0, 0); 
let onGround = false;
let handMesh;
let isSwinging = false;
let swingProgress = 0;

let chunks = {}; 
let activeMeshes = []; 
const chunkSize = 16;
let renderDistance = 3;

let lastChunkUpdatePos = new THREE.Vector3();
let globalGeometry; 
let fpsTime = performance.now();
let fpsFrames = 0;

let gameConfig = { seed: 12345, mode: 'survival', type: 'default' };
let blockMaterials = {}; 
let simplex;

document.getElementById('splash-text').innerText = "Fixed Black Screen!";

/* ==========================================
   ГЕНЕРАТОР ТЕКСТУР
   ========================================== */
function createTexture(colorHex) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 400; i++) {
        const x = Math.floor(Math.random() * size);
        const y = Math.floor(Math.random() * size);
        const alpha = (Math.random() * 0.2).toFixed(2);
        ctx.fillStyle = (Math.random() > 0.5 ? '#000000' : '#ffffff') + Math.floor(alpha * 255).toString(16).padStart(2,'0');
        ctx.fillRect(x, y, 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    return texture;
}

function initMaterials() {
    const texGrassTop = createTexture('#567d46');
    const texDirt = createTexture('#795548');
    const texStone = createTexture('#808080');
    const texWood = createTexture('#8B4513');
    const texLeaves = createTexture('#228B22');
    const texSand = createTexture('#F4A460');
    const texBrick = createTexture('#A52A2A');
    const texBedrock = createTexture('#111111');
    const texGlass = createTexture('#ADD8E6');

    blockMaterials['grass'] = new THREE.MeshLambertMaterial({ map: texGrassTop }); 
    blockMaterials['dirt'] = new THREE.MeshLambertMaterial({ map: texDirt });
    blockMaterials['stone'] = new THREE.MeshLambertMaterial({ map: texStone });
    blockMaterials['wood'] = new THREE.MeshLambertMaterial({ map: texWood });
    blockMaterials['leaves'] = new THREE.MeshLambertMaterial({ map: texLeaves });
    blockMaterials['sand'] = new THREE.MeshLambertMaterial({ map: texSand });
    blockMaterials['brick'] = new THREE.MeshLambertMaterial({ map: texBrick });
    blockMaterials['bedrock'] = new THREE.MeshLambertMaterial({ map: texBedrock });
    blockMaterials['glass'] = new THREE.MeshLambertMaterial({ map: texGlass, transparent: true, opacity: 0.7 });
    
    globalGeometry = new THREE.BoxGeometry(1, 1, 1);
}

/* ==========================================
   СИСТЕМА МЕНЮ И ЛОГИКА
   ========================================== */
// ИСПРАВЛЕННАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ
function showScreen(screenId) {
    // Показываем контейнер меню
    document.getElementById('menu-container').style.display = 'flex';
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('mobile-controls').style.display = 'none';
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // Находим нужный экран. Если ID передан без суффикса, добавляем его.
    let targetId = screenId;
    if (!document.getElementById(targetId)) {
        targetId = screenId + '-screen';
    }
    
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
    } else {
        console.error("Screen not found: " + screenId);
    }
    
    // Если это не меню паузы, то полностью останавливаем игру
    if(targetId !== 'pause-menu') isGameRunning = false;
    
    if(document.pointerLockElement) document.exitPointerLock();
}

function openMenuFromGame() { showScreen('main-menu'); }

const gameModes = ['survival', 'hardcore', 'creative'];
let currentModeIndex = 0;
function cycleGameMode() {
    currentModeIndex = (currentModeIndex + 1) % gameModes.length;
    gameConfig.mode = gameModes[currentModeIndex];
    document.getElementById('btn-gamemode').innerText = "Режим: " + gameConfig.mode.toUpperCase();
}

function createAndStartWorld() {
    // Полный сброс
    Object.values(chunks).forEach(chunk => chunk.forEach(m => { scene.remove(m); }));
    chunks = {};
    activeMeshes = [];
    startGame();
}

function startGame() {
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    
    isPaused = false;
    isGameRunning = true;

    playerStats = { health: 20, food: 20 };
    updateStatsUI();
    document.getElementById('stats-container').style.display = gameConfig.mode === 'creative' ? 'none' : 'flex';

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
    if(isMobile || window.innerWidth < 800) document.getElementById('mobile-controls').style.display = 'block';

    if (!isGameInitialized) {
        initGame();
        isGameInitialized = true;
    }
    
    inventory.setMode(gameConfig.mode);
    
    // Захват только на ПК
    if(!isMobile) document.body.requestPointerLock();
}

function pauseGame() {
    isPaused = true;
    showScreen('pause-menu');
}

function resumeGame() {
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
    if(isMobile) document.getElementById('mobile-controls').style.display = 'block';
    
    isPaused = false;
    isGameRunning = true;
    document.body.requestPointerLock();
}

function saveAndQuit() {
    isGameRunning = false;
    showScreen('main-menu');
}

function backFromSettings() {
    if(isGameRunning && isPaused) showScreen('pause-menu');
    else showScreen('main-menu');
}

// LAN
let isLanPublic = false;
function toggleLanType() {
    isLanPublic = !isLanPublic;
    document.getElementById('btn-lan-type').innerText = isLanPublic ? "Публично" : "Приватно";
    document.getElementById('lan-desc').innerText = isLanPublic ? "Виден всем" : "Только по приглашению";
}
function startLanWorld() {
    alert("Сервер запущен (LAN simulation)");
    resumeGame();
}

function exitGame() { if(confirm("Закрыть?")) window.close(); }

function toggleSetting(key) { 
    if(key === 'render') {
        renderDistance = renderDistance === 3 ? 5 : 3;
        document.getElementById('btn-render').innerText = "Render Dist: " + renderDistance;
        scene.fog.far = renderDistance * 16 + 20;
    } else if (key === 'fov') {
        camera.fov = camera.fov === 75 ? 90 : 75;
        camera.updateProjectionMatrix();
        document.getElementById('btn-fov').innerText = "FOV: " + camera.fov;
    }
}

/* ==========================================
   ДВИЖОК
   ========================================== */
function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, renderDistance * 16 + 20);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ'; 
    camera.position.set(0, 40, 0);

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); 
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    inventory = new Inventory();
    raycaster = new THREE.Raycaster();
    raycaster.far = 6; 
    simplex = new SimplexNoise();

    initMaterials(); 
    initHand();
    initControls();
    
    animate();
}

function initHand() {
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xCCAA88 });
    handMesh = new THREE.Mesh(geo, mat);
    handMesh.position.set(0.3, -0.3, -0.5);
    handMesh.rotation.set(0.2, -0.2, 0);
    camera.add(handMesh);
    scene.add(camera);
}

function swingHand() {
    if(isSwinging) return;
    isSwinging = true;
    swingProgress = 0;
}

function updateHand() {
    if (!isSwinging) return;
    swingProgress += 0.3;
    handMesh.rotation.x = 0.2 + Math.sin(swingProgress) * 0.5;
    handMesh.position.z = -0.5 - Math.sin(swingProgress) * 0.2;
    if (swingProgress >= Math.PI) {
        isSwinging = false;
        handMesh.rotation.x = 0.2;
        handMesh.position.z = -0.5;
    }
}

/* ==========================================
   МИР
   ========================================== */
function getTerrainHeight(x, z) {
    let n1 = simplex.noise2D((x + 12345)/60, (z + 12345)/60);
    let n2 = simplex.noise2D((x + 12345)/20, (z + 12345)/20);
    let h = (n1 * 12) + (n2 * 4) + 10;
    return Math.floor(h);
}

function updateChunks() {
    const px = Math.floor(camera.position.x / chunkSize);
    const pz = Math.floor(camera.position.z / chunkSize);
    
    for (let key in chunks) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - px) > renderDistance || Math.abs(cz - pz) > renderDistance) {
            chunks[key].forEach(m => {
                scene.remove(m);
                const idx = activeMeshes.indexOf(m);
                if (idx > -1) activeMeshes.splice(idx, 1);
            });
            delete chunks[key];
        }
    }
    for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let z = -renderDistance; z <= renderDistance; z++) {
            const cx = px + x;
            const cz = pz + z;
            const key = `${cx},${cz}`;
            if (!chunks[key]) generateChunk(cx, cz);
        }
    }
}

function generateChunk(cx, cz) {
    const chunkMeshes = [];
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const wx = cx * chunkSize + x;
            const wz = cz * chunkSize + z;
            const h = getTerrainHeight(wx, wz);
            let surfaceType = 'grass';
            if(h < 6) surfaceType = 'sand';
            
            const depth = 4; 
            for (let y = Math.max(0, h - depth); y <= h; y++) {
                let type;
                if(y === h) type = surfaceType;
                else if(y > h-3) type = 'dirt';
                else type = 'stone';
                if(y===0) type = 'bedrock';

                const mat = blockMaterials[type];
                const mesh = new THREE.Mesh(globalGeometry, mat);
                mesh.position.set(wx, y, wz);
                mesh.userData = { type: type };
                scene.add(mesh);
                chunkMeshes.push(mesh);
                activeMeshes.push(mesh);
            }
        }
    }
    chunks[`${cx},${cz}`] = chunkMeshes;
}

/* ==========================================
   ФИЗИКА И УПРАВЛЕНИЕ
   ========================================== */
function updatePhysics() {
    if (gameConfig.mode === 'creative') { velocity.y = 0; return; }
    velocity.y -= 0.015; 
    const rayDown = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0), 0, 1.8);
    const intersects = rayDown.intersectObjects(activeMeshes);
    if (intersects.length > 0) {
        const dist = intersects[0].distance;
        if (velocity.y < 0 && dist < 1.65) {
            if (velocity.y < -0.5) takeDamage(Math.floor(Math.abs(velocity.y * 10)));
            velocity.y = 0;
            camera.position.y = intersects[0].point.y + 1.62;
            onGround = true;
        } else onGround = false;
    } else onGround = false;
    camera.position.y += velocity.y;
    if (camera.position.y < -30) takeDamage(20);
}

function takeDamage(amount) {
    if(gameConfig.mode === 'creative') return;
    playerStats.health -= amount;
    updateStatsUI();
    document.body.style.backgroundColor = '#500';
    setTimeout(() => document.body.style.backgroundColor = '#000', 100);
    if (playerStats.health <= 0) {
        if (gameConfig.mode === 'hardcore') {
            alert("GAME OVER! HARDCORE!"); showScreen('main-menu');
        } else {
            camera.position.y = 40; velocity.y = 0; playerStats.health = 20; updateStatsUI();
        }
    }
}

function updateStatsUI() {
    const hBar = document.getElementById('health-bar');
    hBar.innerHTML = '';
    for(let i=0; i<10; i++) {
        const h = document.createElement('div');
        h.className = 'stat-icon heart';
        if(playerStats.health <= i*2) h.classList.add('empty');
        hBar.appendChild(h);
    }
    const fBar = document.getElementById('food-bar');
    fBar.innerHTML = '';
    for(let i=0; i<10; i++) {
        const f = document.createElement('div');
        f.className = 'stat-icon food';
        fBar.appendChild(f);
    }
}

function initControls() {
    document.addEventListener('keydown', e => {
        if(e.code === 'KeyW') moveState.forward = true;
        if(e.code === 'KeyS') moveState.backward = true;
        if(e.code === 'KeyA') moveState.left = true;
        if(e.code === 'KeyD') moveState.right = true;
        if(e.code === 'Space') {
            if(gameConfig.mode === 'creative') moveState.up = true;
            else if(onGround) velocity.y = 0.25; 
        }
        if(e.code === 'ShiftLeft') moveState.down = true;
        if(e.key >= 1 && e.key <= 9) inventory.selectSlot(e.key-1);
        if(e.code === 'Escape') {
            if(isGameRunning) {
                if(isPaused) resumeGame();
                else pauseGame();
            }
        }
    });
    document.addEventListener('keyup', e => {
        if(e.code === 'KeyW') moveState.forward = false;
        if(e.code === 'KeyS') moveState.backward = false;
        if(e.code === 'KeyA') moveState.left = false;
        if(e.code === 'KeyD') moveState.right = false;
        if(e.code === 'Space') moveState.up = false;
        if(e.code === 'ShiftLeft') moveState.down = false;
    });
    
    // ИСПРАВЛЕНИЕ: Мышь работает только если игра идет и не пауза
    document.addEventListener('mousemove', e => {
        if(isGameRunning && !isPaused && document.pointerLockElement === document.body) {
            camera.rotation.y -= e.movementX * 0.002;
            camera.rotation.x -= e.movementY * 0.002;
            camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
        }
    });

    document.addEventListener('mousedown', e => {
        if(!isGameRunning || isPaused || e.target.closest('.hotbar-slot')) return;
        
        if(document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
            return;
        }

        swingHand();
        if(e.button === 0) breakBlock();
        if(e.button === 2) placeBlock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== document.body && isGameRunning && !isPaused) pauseGame();
    });
}

function breakBlock() {
    raycaster.setFromCamera({x:0, y:0}, camera);
    const intersects = raycaster.intersectObjects(activeMeshes);
    if(intersects.length > 0 && intersects[0].distance < 5) {
        const obj = intersects[0].object;
        if(obj.userData.type === 'bedrock' && gameConfig.mode !== 'creative') return;
        scene.remove(obj);
        activeMeshes.splice(activeMeshes.indexOf(obj), 1);
    }
}

function placeBlock() {
    raycaster.setFromCamera({x:0, y:0}, camera);
    const intersects = raycaster.intersectObjects(activeMeshes);
    if(intersects.length > 0 && intersects[0].distance < 5) {
        const p = intersects[0].point.clone().add(intersects[0].face.normal.multiplyScalar(0.5)).floor().addScalar(0.5);
        if(Math.abs(camera.position.x - p.x) < 0.8 && Math.abs(camera.position.y - p.y) < 1.8 && Math.abs(camera.position.z - p.z) < 0.8) return;
        
        const item = inventory.getSelectedBlock();
        if(!item && gameConfig.mode !== 'creative') return;
        const type = item ? item.type : 'dirt';
        
        const mesh = new THREE.Mesh(globalGeometry, blockMaterials[type]);
        mesh.position.copy(p);
        mesh.userData = { type: type };
        scene.add(mesh);
        activeMeshes.push(mesh);
    }
}

function animate() {
    requestAnimationFrame(animate);
    // Рендерим всегда, но обновляем физику только не на паузе
    if(isGameRunning && !isPaused) {
        const now = performance.now();
        fpsFrames++;
        if (now >= fpsTime + 1000) { document.getElementById('fps-counter').innerText = fpsFrames; fpsFrames = 0; fpsTime = now; }

        updateChunks();
        updatePhysics();
        updateHand();

        const speed = 0.15;
        const angle = camera.rotation.y;
        if(moveState.forward) { camera.position.x -= Math.sin(angle)*speed; camera.position.z -= Math.cos(angle)*speed; }
        if(moveState.backward) { camera.position.x += Math.sin(angle)*speed; camera.position.z += Math.cos(angle)*speed; }
        if(moveState.left) { camera.position.x -= Math.sin(angle+Math.PI/2)*speed; camera.position.z -= Math.cos(angle+Math.PI/2)*speed; }
        if(moveState.right) { camera.position.x += Math.sin(angle+Math.PI/2)*speed; camera.position.z += Math.cos(angle+Math.PI/2)*speed; }
        
        if(gameConfig.mode === 'creative') {
            if(moveState.up) camera.position.y += speed;
            if(moveState.down) camera.position.y -= speed;
        }

        const p = camera.position;
        document.getElementById('xyz-pos').innerText = `${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
    }
    renderer.render(scene, camera);
}