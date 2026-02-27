import * as THREE from 'three';

// --- FIREBASE CONFIG ---
const firebaseConfig = { apiKey: "AIzaSyBdOHBV3JXlJgRM3pm3Id8BeGQ96bRZ1vs", projectId: "minecraft-34cd5" };
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- GAME VARS ---
let inventory = { grass:64, dirt:64, stone:64, wood:64, leaves:64, planks:64, glass:64, cobble:64 };
let scene, camera, renderer, raycaster, blocks = [];
let moveF = 0, moveR = 0, lon = 0, lat = 0, velocityY = 0;
let selectedBlock = 'grass';

// --- AUTH ---
const msg = document.getElementById('auth-msg');
document.getElementById('btn-reg').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    if(nick.length < 3) return msg.innerText = "Ник короток";
    const doc = await db.collection("players").doc(nick).get();
    if(doc.exists) msg.innerText = "Занят!";
    else { await db.collection("players").doc(nick).set({t:Date.now()}); login(nick); }
};
document.getElementById('btn-login').onclick = async () => {
    const nick = document.getElementById('input-nick').value.trim();
    const doc = await db.collection("players").doc(nick).get();
    if(doc.exists) login(nick); else msg.innerText = "Нет такого!";
};
function login(n) { localStorage.setItem('mc_nick', n); document.getElementById('display-nick').innerText=n; showScreen('screen-menu'); }
window.logout = () => { localStorage.removeItem('mc_nick'); location.reload(); };
window.showScreen = (id) => { document.querySelectorAll('.screen, #ui-game').forEach(s=>s.style.display='none'); document.getElementById(id).style.display='flex'; };

// --- PHYSICS ENGINE ---
function getPlayerBox(pos) {
    // Хитбокс игрока: ширина 0.6, высота 1.8
    return new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, pos.y - 0.9, pos.z),
        new THREE.Vector3(0.6, 1.8, 0.6)
    );
}

function checkCollision(pos) {
    const pBox = getPlayerBox(pos);
    const bBox = new THREE.Box3();
    for(let i=0; i<blocks.length; i++) {
        bBox.setFromObject(blocks[i]);
        if(pBox.intersectsBox(bBox)) return true;
    }
    return false;
}

// --- GAME CORE ---
const mats = {
    grass: new THREE.MeshStandardMaterial({color: 0x5d9948}),
    dirt: new THREE.MeshStandardMaterial({color: 0x8b4513}),
    stone: new THREE.MeshStandardMaterial({color: 0x808080}),
    wood: new THREE.MeshStandardMaterial({color: 0x6b411a}),
    leaves: new THREE.MeshStandardMaterial({color: 0x2d5a27, transparent:true, opacity:0.8}),
    planks: new THREE.MeshStandardMaterial({color: 0xa47449}),
    glass: new THREE.MeshStandardMaterial({color: 0xadd8e6, transparent:true, opacity:0.5}),
    cobble: new THREE.MeshStandardMaterial({color: 0x666})
};

document.getElementById('btn-start').onclick = () => {
    showScreen('ui-game');
    document.getElementById('ui-game').style.display='block';
    init();
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({antialias:false});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    raycaster = new THREE.Raycaster();

    const geo = new THREE.BoxGeometry(1,1,1);
    for(let x=-8; x<8; x++) {
        for(let z=-8; z<8; z++) {
            const b = new THREE.Mesh(geo, mats.grass);
            b.position.set(x, 0, z);
            scene.add(b);
            blocks.push(b);
        }
    }
    camera.position.set(0, 5, 0);
    controls();
    loop();
}

function controls() {
    nipplejs.create({zone: document.getElementById('joystick-container'), mode: 'static', position: {left: '50px', top: '50px'}})
    .on('move', (e,d) => { moveF = d.vector.y; moveR = d.vector.x; })
    .on('end', () => { moveF = 0; moveR = 0; });

    let tx, ty;
    document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; });
    document.addEventListener('touchmove', e => {
        if(e.touches[0].clientY < window.innerHeight * 0.7) {
            lon += (e.touches[0].clientX - tx) * 0.3;
            lat += (e.touches[0].clientY - ty) * 0.3;
            lat = Math.max(-85, Math.min(85, lat));
            tx = e.touches[0].clientX; ty = e.touches[0].clientY;
        }
    });

    document.querySelectorAll('.slot').forEach(s => {
        s.onclick = () => {
            if(!s.dataset.block) return;
            document.querySelectorAll('.slot').forEach(l=>l.classList.remove('active'));
            s.classList.add('active');
            selectedBlock = s.dataset.block;
        };
    });

    document.getElementById('btn-break').onclick = () => {
        raycaster.setFromCamera({x:0,y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 4) {
            scene.remove(hit[0].object);
            blocks.splice(blocks.indexOf(hit[0].object), 1);
        }
    };

    document.getElementById('btn-place').onclick = () => {
        if(inventory[selectedBlock] <= 0) return;
        raycaster.setFromCamera({x:0,y:0}, camera);
        const hit = raycaster.intersectObjects(blocks);
        if(hit.length > 0 && hit[0].distance < 4) {
            const p = hit[0].object.position;
            const n = hit[0].face.normal;
            const b = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mats[selectedBlock]);
            b.position.set(p.x+n.x, p.y+n.y, p.z+n.z);
            if(!checkCollision(camera.position)) {
                scene.add(b);
                blocks.push(b);
                inventory[selectedBlock]--;
                updateInv();
            }
        }
    };
}

function updateInv() {
    document.querySelectorAll('.slot').forEach(s => {
        const id = s.dataset.block;
        if(id) s.querySelector('.count').innerText = inventory[id];
    });
}

function loop() {
    requestAnimationFrame(loop);
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    camera.lookAt(new THREE.Vector3().setFromSphericalCoords(1, phi, theta).add(camera.position));

    const oldPos = camera.position.clone();

    // Гравитация
    velocityY -= 0.008;
    camera.position.y += velocityY;
    if(checkCollision(camera.position)) {
        camera.position.y = oldPos.y;
        velocityY = 0;
    }

    // Движение
    if(moveF !== 0 || moveR !== 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0; dir.normalize();
        const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
        const moveVec = new THREE.Vector3().addScaledVector(dir, moveF * 0.11).addScaledVector(side, moveR * 0.11);

        // Движение по X
        camera.position.x += moveVec.x;
        if(checkCollision(camera.position)) {
            // Авто-прыжок на X
            camera.position.y += 1.1;
            if(checkCollision(camera.position)) {
                camera.position.x = oldPos.x;
                camera.position.y = oldPos.y;
            }
        }

        // Движение по Z
        camera.position.z += moveVec.z;
        if(checkCollision(camera.position)) {
            // Авто-прыжок на Z
            camera.position.y += 1.1;
            if(checkCollision(camera.position)) {
                camera.position.z = oldPos.z;
                camera.position.y = oldPos.y;
            }
        }
    }
    renderer.render(scene, camera);
}

const sn = localStorage.getItem('mc_nick');
if(sn) login(sn); else showScreen('screen-auth');
updateInv();