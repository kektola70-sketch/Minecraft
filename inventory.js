class Inventory {
    constructor() {
        this.selectedSlot = 0;
        this.mode = 'survival';
        
        // Генерация текстур (чтобы не было черных блоков)
        // Используем Data URIs
        this.blocks = [
            { id: 1, name: "Grass", type: 'grass' },
            { id: 2, name: "Dirt", type: 'dirt' },
            { id: 3, name: "Stone", type: 'stone' },
            { id: 4, name: "Wood", type: 'wood' },
            { id: 5, name: "Leaves", type: 'leaves' },
            { id: 6, name: "Sand", type: 'sand' },
            { id: 7, name: "Glass", type: 'glass' },
            { id: 8, name: "Brick", type: 'brick' },
            { id: 9, name: "Bedrock", type: 'bedrock' }
        ];

        this.slots = new Array(9).fill(null);
        this.initUI();
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'survival' || mode === 'hardcore') {
            this.slots.fill(null);
            // Дадим 1 блок земли для старта
            this.slots[0] = this.blocks[1]; 
        } else {
            for(let i=0; i<9; i++) this.slots[i] = this.blocks[i] || null;
        }
        this.updateUI();
    }

    initUI() {
        const slotsUI = document.querySelectorAll('.hotbar-slot');
        slotsUI.forEach((slot, index) => {
            slot.addEventListener('click', () => { this.selectSlot(index); });
            slot.addEventListener('touchstart', (e) => { e.preventDefault(); this.selectSlot(index); });
        });
        this.updateUI();
    }

    updateUI() {
        // Мы будем брать текстуры из глобального кэша материалов (blockMaterials),
        // который генерируется в script.js. Так как Inventory загружается раньше,
        // сделаем заглушку цветом, а script.js потом обновит.
        const slotsUI = document.querySelectorAll('.hotbar-slot');
        slotsUI.forEach((slot, index) => {
            const item = this.slots[index];
            if (item) {
                // Простая цветовая заглушка для UI
                const colors = { grass: '#567d46', dirt: '#795548', stone: '#888', wood: '#A0522D', leaves: '#228B22', sand: '#F4A460', glass: '#ADD8E6', brick: '#A52A2A', bedrock: '#000' };
                slot.style.backgroundColor = colors[item.type] || '#fff';
            } else {
                slot.style.backgroundColor = 'transparent';
            }
        });
    }

    selectSlot(index) {
        if (index < 0) index = 8; if (index > 8) index = 0;
        this.selectedSlot = index;
        document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.hotbar-slot')[this.selectedSlot].classList.add('active');
    }

    getSelectedBlock() { return this.slots[this.selectedSlot]; }
}