class PremiumLEDDisplay {
    constructor(options = {}) {
        // Configuration
        this.options = {
            container: options.container || document.body,
            text: options.text || "WELCOME TO MY WEBSITE",
            panelWidth: options.panelWidth || 80,
            panelHeight: options.panelHeight || 10,
            ledSize: options.ledSize || 0.85,
            spacing: options.spacing || 1.2,
            offColor: options.offColor || 0x100000,
            scrollSpeed: options.scrollSpeed || 0.4
        };

        // Three.js properties
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.leds = [];
        this.ledStates = [];
        this.border = null;
        
        // Text properties
        this.textBitmap = null;
        this.scrollOffset = 0;
        
        // Color cycling - more attractive colors
        this.colorSequence = [
           new THREE.Color("rgb(255, 0, 0)"), // red
           new THREE.Color("rgb(0, 255, 0)"), // green
           new THREE.Color("rgb(0, 0, 255)") //blue
        ];
        this.currentColorIndex = 0;
        
        // Initialize
        this.init();
        this.createTextBitmap();
        this.createLEDs();
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    init() {
        const containerWidth = this.options.container.clientWidth;
        const containerHeight = this.options.container.clientHeight;
        
        // Create scene with a subtle gradient background
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        
        // Create camera - orthographic for banner-style display
        this.camera = new THREE.PerspectiveCamera(
            40, 
            containerWidth / containerHeight, 
            0.1, 
            1000
        );
        this.updateCameraPosition();
        
        // Create renderer with better quality settings
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(containerWidth, containerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.options.container.appendChild(this.renderer.domElement);
        
        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0x222222);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(0, 10, 15);
        this.scene.add(directionalLight);
        
        // Secondary light for depth
        const fillLight = new THREE.DirectionalLight(0xccccff, 0.4);
        fillLight.position.set(-10, 5, 10);
        this.scene.add(fillLight);
        
        // Accent light for shine
        const accentLight = new THREE.PointLight(0xffffcc, 0.6, 30);
        accentLight.position.set(5, -5, 5);
        this.scene.add(accentLight);
    }
    
    onWindowResize() {
        const containerWidth = this.options.container.clientWidth;
        const containerHeight = this.options.container.clientHeight;
        
        this.camera.aspect = containerWidth / containerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(containerWidth, containerHeight);
    }
    
    updateCameraPosition() {
        const { panelWidth, panelHeight, spacing } = this.options;
        
        // Calculate board dimensions
        const boardWidth = panelWidth * spacing;
        const boardHeight = panelHeight * spacing;
        
        // Set to more dramatic perspective view like the original
        this.camera.position.set(boardWidth * 0.8, boardHeight * 0.6, boardHeight * 1.2);
        this.camera.lookAt(boardWidth / 2, boardHeight / 2, 0);
    }
    
    createTextBitmap() {
        // Create a canvas to render text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions with better text quality
        const fontSize = 32;
        canvas.width = this.options.text.length * fontSize * 0.8;
        canvas.height = fontSize * 2;
        
        // Draw text with better font
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${fontSize}px 'Press Start 2P', sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(this.options.text, 0, canvas.height / 2);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create bitmap (2D array of boolean values)
        this.textBitmap = [];
        for (let y = 0; y < canvas.height; y++) {
            this.textBitmap[y] = [];
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                // Check if pixel is bright (not black)
                this.textBitmap[y][x] = data[pixelIndex] > 128;
            }
        }
        
        // Resize to match panel height
        if (this.textBitmap.length > this.options.panelHeight) {
            // Better downsampling with averaging
            const scaleFactor = this.options.panelHeight / this.textBitmap.length;
            const newBitmap = [];
            
            for (let y = 0; y < this.options.panelHeight; y++) {
                newBitmap[y] = [];
                const srcY = Math.min(Math.floor(y / scaleFactor), this.textBitmap.length - 1);
                
                for (let x = 0; x < this.textBitmap[0].length; x++) {
                    newBitmap[y][x] = this.textBitmap[srcY][x];
                }
            }
            
            this.textBitmap = newBitmap;
        }
    }
    
    createLEDs() {
        // Clear existing LEDs
        if (this.leds.length > 0) {
            this.leds.forEach(led => this.scene.remove(led));
            this.leds = [];
        }
        
        // Remove existing border if any
        if (this.border) {
            this.scene.remove(this.border);
            this.border = null;
        }
        
        const { panelWidth, panelHeight, ledSize, spacing, offColor } = this.options;
        
        // Enhanced LED geometry and materials for better visual quality
        const geometry = new THREE.SphereGeometry(ledSize / 2, 16, 16);
        const material = new THREE.MeshPhongMaterial({ 
            color: offColor,
            specular: 0x555555,
            shininess: 10,
            emissive: 0x110000,
            emissiveIntensity: 0.2
        });
        
        // Initialize LED state array
        this.ledStates = Array(panelHeight).fill().map(() => Array(panelWidth).fill(false));
        
        // Create LED matrix
        for (let y = 0; y < panelHeight; y++) {
            for (let x = 0; x < panelWidth; x++) {
                const led = new THREE.Mesh(geometry, material.clone());
                
                // Position LED
                led.position.set(
                    x * spacing, 
                    (panelHeight - 1 - y) * spacing, 
                    0
                );
                
                this.scene.add(led);
                this.leds.push(led);
            }
        }
        
        // Create a more premium-looking backing board
        const boardWidth = panelWidth * spacing;
        const boardHeight = panelHeight * spacing;
        const boardGeometry = new THREE.BoxGeometry(
            boardWidth, 
            boardHeight, 
            ledSize / 3
        );
        
        // More attractive brushed metal-look back panel
        const boardMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x222222,
            specular: 0x333333,
            shininess: 30,
            bumpScale: 0.02
        });
        
        const board = new THREE.Mesh(boardGeometry, boardMaterial);
        board.position.set(
            boardWidth / 2 - spacing / 2, 
            boardHeight / 2 - spacing / 2, 
            -ledSize / 3
        );
        this.scene.add(board);
        
        // Add premium black encasing/border with beveled edges
        const borderThickness = spacing * 1.2;
        const borderDepth = ledSize * 2;
        
        // Create each edge of the border with beveled corners for a premium look
        
        // Top edge with bevel
        const topEdgeGeometry = new THREE.BoxGeometry(boardWidth, borderThickness, borderDepth);
        const topEdge = new THREE.Mesh(topEdgeGeometry, this.createBorderMaterial());
        topEdge.position.set(
            boardWidth / 2 - spacing / 2,
            boardHeight + borderThickness/2 - spacing / 2,
            -ledSize / 3
        );
        
        // Bottom edge with bevel
        const bottomEdgeGeometry = new THREE.BoxGeometry(boardWidth, borderThickness, borderDepth);
        const bottomEdge = new THREE.Mesh(bottomEdgeGeometry, this.createBorderMaterial());
        bottomEdge.position.set(
            boardWidth / 2 - spacing / 2,
            -borderThickness/2 - spacing / 2,
            -ledSize / 3
        );
        
        // Left edge with bevel
        const leftEdgeGeometry = new THREE.BoxGeometry(borderThickness, boardHeight, borderDepth);
        const leftEdge = new THREE.Mesh(leftEdgeGeometry, this.createBorderMaterial());
        leftEdge.position.set(
            -borderThickness/2 - spacing / 2,
            boardHeight / 2 - spacing / 2,
            -ledSize / 3
        );
        
        // Right edge with bevel
        const rightEdgeGeometry = new THREE.BoxGeometry(borderThickness, boardHeight, borderDepth);
        const rightEdge = new THREE.Mesh(rightEdgeGeometry, this.createBorderMaterial());
        rightEdge.position.set(
            boardWidth + borderThickness/2 - spacing / 2,
            boardHeight / 2 - spacing / 2,
            -ledSize / 3
        );
        
        // Group all edges
        this.border = new THREE.Group();
        this.border.add(topEdge);
        this.border.add(bottomEdge);
        this.border.add(leftEdge);
        this.border.add(rightEdge);
        
        this.scene.add(this.border);
    }
    
    createBorderMaterial() {
        // Premium glossy black finish for the border
        return new THREE.MeshPhongMaterial({ 
            color: 0x0a0a0a,
            specular: 0x333333,
            shininess: 60,
            reflectivity: 0.5
        });
    }
    
    updateLEDs() {
        const { panelWidth, panelHeight, offColor } = this.options;
        const currentColor = this.colorSequence[this.currentColorIndex];
        
        // Update each LED
        for (let y = 0; y < panelHeight; y++) {
            for (let x = 0; x < panelWidth; x++) {
                // Get bitmap coordinates
                const bitmapX = x + Math.floor(this.scrollOffset);
                
                // Determine if LED is on
                let isOn = false;
                
                if (this.textBitmap && 
                    y < this.textBitmap.length && 
                    bitmapX >= 0 && 
                    bitmapX < this.textBitmap[0].length) {
                    isOn = this.textBitmap[y][bitmapX];
                }
                
                // Update LED color with enhanced glow effect
                const ledIndex = y * panelWidth + x;
                if (ledIndex < this.leds.length) {
                    if (isOn) {
                        // Create glowing effect for on LEDs
                        this.leds[ledIndex].material.color = currentColor.clone();
                        this.leds[ledIndex].material.emissive = currentColor.clone();
                        this.leds[ledIndex].material.emissiveIntensity = 0.7;
                    } else {
                        // Dim effect for off LEDs
                        this.leds[ledIndex].material.color = new THREE.Color(offColor);
                        this.leds[ledIndex].material.emissive = new THREE.Color(offColor);
                        this.leds[ledIndex].material.emissiveIntensity = 0.1;
                    }
                    this.ledStates[y][x] = isOn;
                }
            }
        }
    }
    
    updateScrollPosition() {
        if (!this.textBitmap || this.textBitmap.length === 0) {
            return;
        }
        
        const textWidth = this.textBitmap[0].length;
        
        // Update scroll position with smooth acceleration/deceleration
        this.scrollOffset += this.options.scrollSpeed;
        
        // Reset when text is fully off-screen and change color
        if (this.scrollOffset >= textWidth + this.options.panelWidth) {
            this.scrollOffset = -this.options.panelWidth;
            
            // Cycle to the next color in the sequence
            this.currentColorIndex = (this.currentColorIndex + 1) % this.colorSequence.length;
        }
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // More pronounced movement for the perspective view
        if (this.border) {
            this.border.rotation.y = Math.sin(Date.now() * 0.0003) * 0.05;
            this.border.rotation.x = Math.sin(Date.now() * 0.0004) * 0.02;
        }
        
        this.updateScrollPosition();
        this.updateLEDs();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    // Public method to change text
    setText(text) {
        this.options.text = text;
        this.scrollOffset = -this.options.panelWidth; // Start offscreen
        this.createTextBitmap();
    }
}

// Initialize the LED display banner
function initLEDBanner(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (container) {
        return new PremiumLEDDisplay({
            container,
            ...options
        });
    }
    console.error('Container not found');
    return null;
}