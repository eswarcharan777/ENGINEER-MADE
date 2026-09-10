"""Additional core-engineering roadmaps used by the local catalog."""

NPTEL = "https://onlinecourses.nptel.ac.in/"


def build_path(path_id, title, description, icon, color, skills, stages):
    modules = []
    for module_index, (module_title, topics) in enumerate(stages, 1):
        module_id = f"{path_id[:3]}-{module_index}"
        modules.append({
            "id": module_id,
            "title": module_title,
            "lessons": [
                {
                    "id": f"{module_id}-{lesson_index}",
                    "title": topic,
                    "type": "course",
                    "externalUrl": NPTEL,
                    "duration": "Self-paced",
                }
                for lesson_index, topic in enumerate(topics, 1)
            ],
        })
    return {
        "id": path_id, "title": title, "description": description,
        "icon": icon, "color": color, "skills": skills, "duration": "6 months",
        "modules": modules,
        "resources": [
            {"title": "NPTEL Engineering Courses", "url": NPTEL, "type": "course"},
            {"title": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/search/", "type": "course"},
        ],
    }


ADDITIONAL_LEARNING_PATHS = {
    item["id"]: item for item in [
        build_path("mechanical-engineer", "Mechanical Engineer", "Design, analyze, manufacture, and maintain mechanical systems.", "⚙️", "#F97316", ["Engineering Mechanics", "CAD", "Thermodynamics", "Manufacturing", "FEA"], [
            ("Engineering foundations", ["Engineering Mechanics", "Engineering Mathematics"]),
            ("Core mechanical systems", ["Thermodynamics and Heat Transfer", "Fluid Mechanics"]),
            ("Design and manufacturing", ["Machine Design and CAD", "Manufacturing Processes"]),
            ("Industry readiness", ["Finite Element Analysis", "Mechanical Capstone Project"]),
        ]),
        build_path("civil-engineer", "Civil Engineer", "Plan and build safe structures, transportation systems, and sustainable infrastructure.", "🏗️", "#CA8A04", ["Structures", "Surveying", "Geotechnical", "Transportation", "AutoCAD"], [
            ("Civil engineering foundations", ["Introduction to Civil Engineering", "Engineering Mechanics"]),
            ("Structures and materials", ["Strength of Materials", "Structural Analysis"]),
            ("Ground and infrastructure", ["Geotechnical Engineering", "Transportation Engineering"]),
            ("Professional practice", ["Construction Planning", "Civil Engineering Capstone"]),
        ]),
        build_path("electrical-engineer", "Electrical Engineer", "Build expertise in circuits, machines, power systems, and control.", "⚡", "#EAB308", ["Circuits", "Machines", "Power Systems", "Control", "MATLAB"], [
            ("Circuit foundations", ["Basic Electrical Engineering", "Circuit Theory"]),
            ("Machines and power", ["Electrical Machines", "Power Systems"]),
            ("Control and protection", ["Control Systems", "Power Electronics"]),
            ("Industry readiness", ["Electrical Design Tools", "Electrical Capstone Project"]),
        ]),
        build_path("electronics-engineer", "Electronics & Communication Engineer", "Learn analog, digital, communication, embedded, and VLSI systems.", "📡", "#06B6D4", ["Analog", "Digital", "Signals", "VLSI", "Embedded"], [
            ("Electronics foundations", ["Analog Electronics", "Digital Electronics"]),
            ("Signals and communication", ["Signals and Systems", "Communication Systems"]),
            ("Hardware systems", ["Microprocessors and Microcontrollers", "VLSI Design"]),
            ("Industry readiness", ["PCB Design", "Electronics Capstone Project"]),
        ]),
        build_path("chemical-engineer", "Chemical Engineer", "Design safe processes that transform materials at industrial scale.", "🧪", "#10B981", ["Mass Transfer", "Heat Transfer", "Reactions", "Process Control", "Safety"], [
            ("Chemical foundations", ["Chemical Process Calculations", "Chemical Engineering Thermodynamics"]),
            ("Transport phenomena", ["Fluid Flow Operations", "Heat and Mass Transfer"]),
            ("Plant systems", ["Chemical Reaction Engineering", "Process Dynamics and Control"]),
            ("Safety and design", ["Process Safety", "Plant Design Project"]),
        ]),
        build_path("aerospace-engineer", "Aerospace Engineer", "Study flight, propulsion, structures, and spacecraft systems.", "🚀", "#6366F1", ["Aerodynamics", "Propulsion", "Flight Mechanics", "Structures", "CFD"], [
            ("Aerospace foundations", ["Introduction to Aerospace Engineering", "Engineering Mathematics for Flight"]),
            ("Flight sciences", ["Aerodynamics", "Flight Mechanics"]),
            ("Vehicle systems", ["Aircraft Structures", "Aerospace Propulsion"]),
            ("Advanced practice", ["Computational Fluid Dynamics", "Aerospace Design Project"]),
        ]),
        build_path("robotics-engineer", "Robotics Engineer", "Combine mechanics, electronics, control, and software to build intelligent robots.", "🦾", "#8B5CF6", ["ROS", "Control", "Computer Vision", "Embedded", "Kinematics"], [
            ("Robotics foundations", ["Robot Kinematics", "Sensors and Actuators"]),
            ("Control and embedded", ["Control Systems for Robotics", "Embedded Programming"]),
            ("Robot intelligence", ["Computer Vision", "Robot Operating System (ROS)"]),
            ("Applied robotics", ["Autonomous Navigation", "Robotics Capstone Project"]),
        ]),
        build_path("automotive-engineer", "Automotive Engineer", "Engineer modern vehicles, powertrains, electronics, and mobility systems.", "🚗", "#EF4444", ["Vehicle Dynamics", "IC Engines", "EV", "CAD", "Diagnostics"], [
            ("Automotive foundations", ["Automobile Engineering", "Vehicle Dynamics"]),
            ("Powertrains", ["Internal Combustion Engines", "Transmission Systems"]),
            ("Modern vehicles", ["Electric Vehicle Technology", "Automotive Electronics"]),
            ("Design and validation", ["Automotive CAD and CAE", "Vehicle Design Project"]),
        ]),
        build_path("biomedical-engineer", "Biomedical Engineer", "Apply engineering to medical devices, imaging, signals, and healthcare.", "🫀", "#EC4899", ["Biomechanics", "Medical Imaging", "Biosignals", "Devices", "Regulation"], [
            ("Biomedical foundations", ["Human Physiology for Engineers", "Biomedical Instrumentation"]),
            ("Signals and imaging", ["Biomedical Signal Processing", "Medical Imaging"]),
            ("Devices and materials", ["Biomechanics", "Biomaterials and Medical Devices"]),
            ("Clinical practice", ["Medical Device Regulation", "Biomedical Capstone Project"]),
        ]),
    ]
}
