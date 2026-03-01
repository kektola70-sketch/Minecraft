class Inventory {
    constructor() {
        this.selectedSlot = 0;
        this.blocks = [
            { id: 1, color: 0x567d46, name: "Grass" },
            { id: 2, color: 0x795548, name: "Dirt" },
            { id: 3, color: 0x888888, name: "Stone" },
            { id: 4, color: 0xA0522D, name: "Wood" },
            { id: 5, color: 0xFFD700, name: "Gold" },
            { id: 6, color: 0xFFFFFF, name: "Iron" },
            { id: 7, color: 0x0000FF, name: "Water" },
            { id: 8, color: 0xFF0000, name: "TNT" },
            { id: 9, color: 0x000000, name: "Bedrock" }
        ];
        this.initUI();
    }

    initUI() {
        const slots = document.querySelectorAll('.hotbar-slot');
        slots.forEach((slot, index) => {
            if (this.blocks[index]) {
                const color = '#' + this.blocks[index].color.toString(16).padStart(6, '0');
                slot.style.backgroundColor = color;
            }
            slot.addEventListener('click', () => { this.selectSlot(index); });
            slot.addEventListener('touchstart', (e) => { e.preventDefault(); this.selectSlot(index); });
        });
    }

    selectSlot(index) {
        if (index < 0) index = 8;
        if (index > 8) index = 0;
        this.selectedSlot = index;
        document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.hotbar-slot')[this.selectedSlot].classList.add('active');
    }

    getSelectedBlock() { return this.blocks[this.selectedSlot]; }
}