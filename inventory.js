class Inventory {
    constructor() {
        this.selectedSlot = 0;
        this.blocks = [
            { id: 1, color: 0x567d46, name: "Grass" },   // Слот 1
            { id: 2, color: 0x795548, name: "Dirt" },    // Слот 2
            { id: 3, color: 0x808080, name: "Stone" },   // Слот 3
            { id: 4, color: 0xA0522D, name: "Wood" },    // Слот 4
            { id: 5, color: 0xD2B48C, name: "Iron Ore" },// Слот 5 (Руда)
            { id: 6, color: 0xFFD700, name: "Gold" },    // Слот 6
            { id: 7, color: 0x111111, name: "Bedrock" }, // Слот 7
            { id: 8, color: 0xFF0000, name: "TNT" },     // Слот 8
            { id: 9, color: 0x0000FF, name: "Water" }    // Слот 9
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