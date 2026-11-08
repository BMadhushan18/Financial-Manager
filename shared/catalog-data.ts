// MoneyMind item catalogue (data only). Parsed by shared/catalog.ts.
//
// One item per line:   Name | Wikipedia article (photo) | other words people type
//  - The article is optional (defaults to the name). Use "-" for "no photo".
//  - A leading "~" flips the section's NEED/WANT label for that item.
// Photos are resolved by scripts/build-catalog-images.ts (free licences only).

import type { EntryType } from './types';

export interface CatalogSection {
  category: string;
  type: EntryType;
  items: string;
}

export const CATALOG_SECTIONS: CatalogSection[] = [
  {
    category: 'Food & groceries',
    type: 'NEED',
    items: `
Rice | White rice | samba, nadu, keeri samba, basmati, red rice, haal
Dhal | Masoor dal | dal, lentils, parippu, red lentils
Bread | Bread | paan, loaf, sandwich bread
Eggs | Egg as food | egg, biththara, bittara
Milk powder | Powdered milk | anchor, highland, kiri piti, nespray
Fresh milk | Milk | milk, kiri
Yoghurt | Yogurt | yogurt, curd, kiri
Curd | Dahi (curd) | buffalo curd, meekiri
Butter | Butter | margarine
Cheese | Cheese | cheddar, processed cheese
Coconuts | Coconut | pol, coconut, scraped coconut
Coconut milk | Coconut milk | pol kiri, coconut cream
Vegetables | Vegetable | veg, elawalu, greens
Fruits | Fruit | fruit
Bananas | Banana | kesel, ambul, banana
Mangoes | Mango | amba, mango
Papaya | Papaya | gaslabu
Pineapple | Pineapple | annasi
Apples | Apple | apple
Oranges | Orange (fruit) | dodam, orange
Grapes | Grape | grape
Watermelon | Watermelon | komadu
Avocado | Avocado | aligatapera
Limes | Lime (fruit) | dehi, lemon, lime
Tomatoes | Tomato | thakkali, tomato
Carrots | Carrot | carrot
Beans | Green bean | bonchi, green beans
Cabbage | Cabbage | gova
Leeks | Leek | leeks
Pumpkin | Pumpkin | wattakka
Brinjals | Eggplant | wambatu, eggplant, aubergine
Okra | Okra | bandakka, ladies fingers
Green chillies | Chili pepper | amu miris, chillies, chilli
Garlic | Garlic | sudulunu
Ginger | Ginger | inguru
Onions | Onion | lunu, big onion, red onion, rathu lunu
Potatoes | Potato | ala, potato
Sweet potatoes | Sweet potato | bathala
Cassava | Cassava | manioc, manyokka
Mushrooms | Edible mushroom | mushroom, bimmal
Spinach | Spinach | nivithi, kankun, gotukola
Fish | Fish as food | malu, seer fish, balaya, kelawalla
Tuna | Tuna | tuna, kelawalla
Dried fish | - | karawala, umbalakada, sprats, haal masso
Prawns | Prawn | isso, shrimp
Crab | Crab meat | kakuluwo
Chicken | Chicken as food | kukul mas, broiler, chicken breast
Beef | Beef | harak mas
Pork | Pork | ooru mas
Mutton | Lamb and mutton | goat meat, elu mas
Sausages | Sausage | sausage
Canned fish | Canned fish | tin fish, mackerel, salmon tin
Sugar | Sugar | seeni, brown sugar
Salt | Salt | lunu, table salt
Tea leaves | Tea | tea, thea kola, dilmah
Coffee powder | Coffee bean | coffee, nescafe
Cooking oil | Cooking oil | coconut oil, vegetable oil, oil
Wheat flour | Flour | flour, piti, atta
Rice flour | Rice flour | haal piti, kurakkan piti
Noodles | Instant noodle | maggi, noodles, ramen
Pasta | Pasta | spaghetti, macaroni
Spices | Spice | curry powder, masala, thuna paha
Chilli powder | Chili powder | miris kudu, chilli flakes
Turmeric | Turmeric | kaha
Black pepper | Black pepper | gammiris, pepper
Cinnamon | Cinnamon | kurundu
Cardamom | Cardamom | enasal
Soy sauce | Soy sauce | soya sauce
Tomato sauce | Ketchup | ketchup, sauce
Jam | Fruit preserves | jam
Peanut butter | Peanut butter | peanut butter
Honey | Honey | mee pani, bee honey
Kithul treacle | Treacle | treacle, kithul pani, jaggery, hakuru
Biscuits | Biscuit | cookies, crackers, munchee, maliban
Chocolate bar | Chocolate bar | chocolate, kitkat
Chips | Potato chip | crisps, snacks
Nuts | Nut (food) | cashew, cadju, peanuts, kadala
Breakfast cereal | Breakfast cereal | cornflakes, cereal, oats
Oats | Oatmeal | oats, porridge
Soya meat | Textured vegetable protein | soya, soy meat
Chickpeas | Chickpea | kadala, gram
Green gram | Mung bean | mung, mung eta
Ice cream tub | Ice cream | ice cream
Soft drinks | Soft drink | soda, coca cola, sprite, fanta
Fruit juice | Juice | juice, cordial
Drinking water | Bottled water | water bottle, mineral water
Baby milk formula | Infant formula | formula, lactogen
Weekly groceries | Grocery store | groceries, supermarket, keells, cargills, food city, arpico
Bakery items | Bakery | bakery, buns, pastry, short eats
Frozen food | Frozen food | frozen
`,
  },
  {
    category: 'Transport',
    type: 'NEED',
    items: `
Bike fuel | Filling station | petrol, fuel, refuel, octane, gas station
Car fuel | Gasoline | car petrol, diesel, fuel
Diesel | Diesel fuel | diesel
Bus fare | Bus | bus, ticket
Train ticket | Train | train, railway, season ticket
Tuk-tuk ride | Auto rickshaw | three wheeler, tuk tuk, pickme, uber, taxi app
Taxi | Taxicab | cab, car hire, kangaroo cabs
Bike service | Motorcycle | service, oil change, motorbike service
Car service | Auto mechanic | car repair, garage, servicing
Engine oil | Motor oil | oil change, lubricant
Tyres | Tire | tyre, tire, tube
Car battery | Automotive battery | battery
Helmet | Motorcycle helmet | helmet
Parking | Parking space | parking fee
Highway toll | Toll road | expressway, toll
Vehicle insurance | - | car insurance, bike insurance
Revenue licence | Vehicle registration plate | license, revenue license, emission test
Driving lessons | - | driving licence, learner
~Car / bike wash | Car wash | wash, detailing
~Motorbike | Motorcycle | bike, scooter, honda dio, bajaj, yamaha
~Scooter | Scooter (motorcycle) | scooty, dio, activa
~Car | Sedan (automobile) | vehicle, toyota, suzuki alto, honda
~Electric scooter | Motorized scooter | e-scooter
Bicycle repair | Bicycle | puncture, bike repair
Car seat cover | Car seat | seat cover
Dash camera | Dashcam | dashcam
`,
  },
  {
    category: 'Medicine & health',
    type: 'NEED',
    items: `
Medicine | Medication | pharmacy, tablets, pills, beheth, drugs
Doctor visit | Stethoscope | channelling, channeling, clinic, consultation
Hospital bill | Hospital | hospital, admission, ward
Lab tests | Medical laboratory | blood test, lab report, scan
X-ray | Radiography | xray, scan
Vitamins | Dietary supplement | supplements, multivitamin
Spectacles | Glasses | glasses, eye test, lenses
Contact lenses | Contact lens | lenses
Dentist | Dentistry | dental, tooth, filling
Braces | Dental braces | orthodontic
First aid kit | First aid kit | first aid
Thermometer | Thermometer | thermometer
Blood pressure monitor | Blood pressure | bp machine, pressure meter
Glucose meter | Glucose meter | sugar test, glucometer
Face masks | Surgical mask | mask
Hand sanitizer | Hand sanitizer | sanitiser
Ayurvedic treatment | Ayurveda | ayurveda, osu, wedamahattaya
Physiotherapy | Physical therapy | physio
Health insurance | - | medical insurance
Pain relief balm | - | siddhalepa, balm
Hearing aid | Hearing aid | hearing
Wheelchair | Wheelchair | wheel chair
Crutches | Crutch | walker
`,
  },
  {
    category: 'Utilities',
    type: 'NEED',
    items: `
Electricity bill | Electricity meter | ceb, light bill, current bill, leco
Water bill | Water metering | water board, nwsdb
Gas cylinder | Gas cylinder | litro, laugfs, lp gas, cooking gas
Garbage collection | Waste collection | garbage, rubbish
Solar panels | Solar panel | solar
Generator | Engine-generator | generator
UPS | Uninterruptible power supply | inverter, ups
Kerosene | Kerosene lamp | paraffin, bhumithel
Firewood | Firewood | dara
`,
  },
  {
    category: 'Rent & housing',
    type: 'NEED',
    items: `
House rent | Single-family detached home | rent, annex, apartment rent
Boarding fees | Boarding house | boarding, hostel
Home loan payment | - | housing loan, mortgage
House repairs | Home repair | repair, maintenance
Plumber | Plumber | plumbing, pipe repair
Electrician | Electrician | wiring
Painting the house | House painter and decorator | paint, painter
Roof repair | Roof | roof, tiles
Cement | Cement | cement bags
Water tank | Water tank | tank
Water pump | Pump | motor, water motor
Home insurance | - | house insurance
Locks | Lock and key | padlock, door lock
CCTV camera | Closed-circuit television camera | cctv, security camera
`,
  },
  {
    category: 'Phone & internet',
    type: 'NEED',
    items: `
Mobile reload | SIM card | reload, dialog, mobitel, hutch, airtel, top up, recharge
Mobile data package | Mobile broadband | data package, data card
Internet / Wi-Fi | Wireless router | wifi, fibre, broadband, slt
Postpaid phone bill | Mobile phone | phone bill
Landline bill | Landline | telephone
TV channels | Satellite television | dialog tv, peo tv, cable tv
Phone repair | Mobile phone | screen repair, phone service
~Phone cover | Mobile phone accessories | case, back cover, tempered glass
Phone charger | Mobile phone charger | charger, cable, usb cable
`,
  },
  {
    category: 'Education',
    type: 'NEED',
    items: `
School fees | School | fees, facility fees
Tuition class | Classroom | class, tuition, tution, extra class
University fees | University | campus, degree, semester fees
Exam fees | Exam | exam, ol, al, ielts
Books | Book | book, textbook, novel
Exercise books | Exercise book | copy books, notebooks
Stationery | Stationery | pens, pencils, erasers, rulers
Pens | Ballpoint pen | pen, biro
Pencils | Pencil | pencil
School uniform | School uniform | uniform
School shoes | Shoe | white shoes, black shoes
School bag | Backpack | bag, backpack
Water bottle | Water bottle | bottle
Lunch box | Lunch box | lunchbox
Online course | Educational technology | course, udemy, coursera
Calculator | Calculator | scientific calculator
Geometry box | Compass (drawing tool) | maths set, protractor
School van | School bus | school transport, van fee
Library membership | Library | library
Laptop for studies | Laptop | study laptop
Printing & photocopies | Photocopier | print, photocopy, printouts
`,
  },
  {
    category: 'Household',
    type: 'NEED',
    items: `
Washing powder | Laundry detergent | detergent, sunlight, surf, rinso
Dishwashing liquid | Dishwashing liquid | vim, dish soap, sunlight bar
Floor cleaner | - | harpic, phenyl, cleaning liquid
Toilet cleaner | Toilet cleaner | harpic
Toilet paper | Toilet paper | tissue roll
Tissues | Facial tissue | tissue box, napkins
Garbage bags | Bin bag | bin liners, shopping bags
Broom | Broom | idala, kosu
Mop | Mop | mop
Bucket | Bucket | basin
Sponges | Sponge (tool) | scrubber, steel wool
Insect repellent | Insect repellent | mosquito coil, baygon, mortein
Mosquito net | Mosquito net | net
Light bulbs | LED lamp | bulb, led, tube light
Batteries | Battery (electricity) | AA battery, eveready
Extension cord | Power strip | extension, multi plug
Matches | Match | matchbox, lighter
Candles | Candle | candle
Kitchen knife | Kitchen knife | knife
Cooking pots | Cookware and bakeware | pots, pans, saucepan, kadai
Non-stick pan | Non-stick surface | frying pan, tawa
Pressure cooker | Pressure cooker | cooker
Plates & bowls | Tableware | plates, cups, mugs, glasses
Cutlery | Cutlery | spoons, forks
Food containers | Food storage container | lunch box, tupperware
Rice cooker | Rice cooker | cooker
Gas cooker | Gas stove | stove, gas cooker, burner
Electric kettle | Electric kettle | kettle
Water filter | - | purifier, filter
Ironing board | Ironing board | iron board
Clothes iron | Clothes iron | iron, steam iron
Electric fan | Mechanical fan | fan, table fan, ceiling fan, pedestal fan
Bedsheets | Bed sheet | sheets, pillow cases
Pillows | Pillow | pillow
Towels | Towel | towel
Curtains | Curtain | curtains, blinds
Mattress | Mattress | bed
Clothes hangers | Clothes hanger | hangers
Clothes drying rack | Clothes horse | drying rack
Laundry basket | Laundry basket | basket
Gardening tools | Garden tool | mammoty, spade, garden
Plant pots | Flowerpot | pots, plants
~Refrigerator | Refrigerator | fridge, freezer
~Washing machine | Washing machine | washer
~Microwave oven | Microwave oven | microwave
~Oven | Oven | baking oven
~Blender | Blender (appliance) | mixer, grinder
~Toaster | Toaster | sandwich maker
~Air fryer | Air fryer | airfryer
~Vacuum cleaner | Vacuum cleaner | vacuum, hoover
~Air conditioner | Air conditioning | ac, aircon
~Water heater | - | geyser, hot water
~Sofa | Couch | couch, settee, sofa set
~Dining table | Table (furniture) | table, dining set
~Bed frame | Bed | bed, cot
~Wardrobe | - | almirah, cupboard, closet
~Bookshelf | Bookcase | shelf, rack
~Office chair | Office chair | chair, desk chair
~Office desk | Desk | desk, study table
~Plastic chairs | Plastic chair | chairs
~Carpet | Carpet | rug, mat
~Wall clock | Clock | clock
~Mirror | Mirror | mirror
~Lamp | Light fixture | table lamp, reading lamp
~Shoe rack | Shoe rack | rack
~Home decor | Interior design | decorations, vase
~Cleaning service | - | housemaid, cleaner, domestic help
`,
  },
  {
    category: 'Personal care',
    type: 'NEED',
    items: `
Soap | Soap | lux, lifebuoy, baby soap
Shampoo | Shampoo | sunsilk, clinic plus
Conditioner | - | conditioner
Toothpaste | Toothpaste | signal, clogard
Toothbrush | Toothbrush | brush
Mouthwash | Mouthwash | listerine
Dental floss | Dental floss | floss
Deodorant | Deodorant | roll on, body spray, antiperspirant
Body lotion | Lotion | lotion, moisturiser, cream
Face wash | - | cleanser
Sunscreen | Sunscreen | sunblock, spf
Razor | Razor | shaving, blades, gillette
Shaving cream | Shaving cream | foam
Sanitary pads | Sanitary napkin | pads, napkins, fems
Cotton buds | Cotton swab | earbuds, cotton
Hair oil | - | coconut hair oil, kumarika
Hair dye | Hair coloring | dye, colour
Comb | Comb | hair brush
Nail cutter | Nail clipper | nail clipper
Haircut | Barber | salon, barber, hair cut
~Beauty salon | Beauty salon | facial, makeup, threading
~Makeup | Cosmetics | lipstick, foundation, kajal, eyeliner
~Perfume | Eau de toilette | cologne, body spray
~Hair dryer | Hair dryer | dryer
~Hair straightener | - | straightener, curler
~Electric shaver | Electric razor | trimmer, shaver
~Spa visit | Day spa | massage, spa
`,
  },
  {
    category: 'Kids & baby',
    type: 'NEED',
    items: `
Diapers | Diaper | nappies, nappy, pampers, huggies
Baby wipes | Wet wipe | wipes
Baby food | Baby food | cerelac, weaning food
Feeding bottle | Baby bottle | bottle, nipple
Baby clothes | Infant clothing | baby dress, rompers
Baby lotion | Lotion | baby oil, baby powder
Pacifier | Pacifier | soother, dummy
Baby carrier | Baby sling | carrier
Baby cot | Infant bed | crib, cradle
~Pram | Baby transport | stroller, buggy, pushchair
Car seat for baby | Child safety seat | car seat
Kids clothes | Children's clothing | kids dress, frock
Kids shoes | Shoe | baby shoes
Daycare | Child care | preschool, montessori, nursery
Baby vaccinations | Vaccination | vaccine
~Toys | Toy | toy, doll, toy car
~Lego | Lego | building blocks
~Kids bicycle | Balance bicycle | kids bike, tricycle
~Colouring books | Coloring book | crayons, colour pencils
~Birthday party | Party | kids party, balloons
`,
  },
  {
    category: 'Pets',
    type: 'NEED',
    items: `
Dog food | Dog food | pedigree, dog meal
Cat food | Cat food | whiskas, cat meal
Fish food | Fish food | aquarium food
Bird seed | Bird food | bird food
Vet visit | Veterinarian | vet, veterinary, animal hospital
Pet vaccinations | Vaccination | rabies vaccine
Flea treatment | - | tick, flea
Cat litter | Litter box | litter
Pet shampoo | - | dog shampoo
Dog leash | Leash | collar, lead
~Pet bed | - | dog bed
~Pet toys | Dog toy | chew toy
~Aquarium | Aquarium | fish tank
~Bird cage | - | cage
~Pet grooming | Dog grooming | grooming
`,
  },
  {
    category: 'Eating out',
    type: 'WANT',
    items: `
Restaurant meal | Restaurant | dinner, lunch, meal, dining
Rice and curry | Sri Lankan cuisine | bath packet, lunch packet
Kottu | Kottu | koththu
Fried rice | Fried rice | nasi goreng
Biryani | Biryani | buriyani
Hoppers | Appam | appa, egg hopper, string hoppers, indiappa
Coffee | Coffee | cafe, latte, cappuccino, espresso
Tea at a cafe | Masala chai | tea, milk tea, kiri thea
Pizza | Pizza | pizza hut, dominos
Burger | Hamburger | mcdonalds, burger king
Fried chicken | Fried chicken | kfc
Shawarma | Shawarma | wrap
Sandwich | Sandwich | sub, subway
Ice cream | Ice cream | ice cream cone, sundae
Cake | Cake | birthday cake, gateau
Short eats | Samosa | snacks, rolls, patties, cutlets
Bubble tea | Bubble tea | boba
Smoothie | Smoothie | milkshake, juice bar
Sushi | Sushi | japanese
Noodles at a restaurant | Chinese noodles | chinese, chopsuey
Food delivery | Food delivery | uber eats, pickme food, delivery
Street food | Street food | isso wade, kadala
Buffet | Buffet | hotel buffet
`,
  },
  {
    category: 'Entertainment',
    type: 'WANT',
    items: `
Movie ticket | Movie projector | cinema, film, scope cinema
Concert ticket | Concert | show, musical, live music
Cricket match | Cricket | match ticket
Theme park | Amusement park | water park, rides
Zoo visit | Zoo | dehiwala zoo, safari park
Museum ticket | Museum | museum
Bowling | Bowling | bowling alley
Karaoke | Karaoke | singing
Video game | Video game | game, ps5 game, steam
Mobile game purchase | Mobile game | in-app purchase, game top up
Board game night | Board game | games night
Party | Party | night out, club
Event ticket | Ticket (admission) | tickets
`,
  },
  {
    category: 'Subscriptions',
    type: 'WANT',
    items: `
Netflix | - | streaming
Spotify | Earphone | music streaming
YouTube Premium | YouTube | youtube
Amazon Prime | Amazon Prime Video | prime video
Disney+ | Disney+ | disney plus, hotstar
iCloud storage | ICloud | icloud
Google One storage | Google Drive | google storage
ChatGPT Plus | ChatGPT | chatgpt, ai subscription
Microsoft 365 | Microsoft 365 | office 365
Newspaper | Newspaper | paper, daily news
Magazine | - | magazine
Gym membership | Dumbbell | gym, fitness centre
Club membership | Country club | club
Software licence | - | software, app subscription
Cloud backup | Data center | backup
`,
  },
  {
    category: 'Gadgets',
    type: 'WANT',
    items: `
Smartphone | Smartphone | phone, iphone, samsung, mobile, android
iPhone | IPhone | apple phone
Samsung Galaxy phone | Samsung Galaxy | galaxy, samsung phone
Headphones | Headphones | headset
Wireless earbuds | AirPods | airpods, buds, earbuds
Laptop | Laptop | notebook, computer
MacBook | MacBook | apple laptop
Desktop computer | Desktop computer | pc, computer
Gaming PC | Gaming computer | gaming computer
Monitor | Computer monitor | screen, display
Keyboard | Computer keyboard | keyboard
Mouse | Computer mouse | mouse
Printer | Printer (computing) | printer, ink
Printer ink | Ink cartridge | toner, cartridge
Router | Wireless router | wifi router
External hard drive | Hard disk drive | hard disk, ssd, storage
USB flash drive | USB flash drive | pen drive, pendrive
Memory card | Memory card | sd card, micro sd
Smartwatch | Smartwatch | apple watch, galaxy watch
Fitness band | Activity tracker | fitness tracker, mi band
Tablet | Tablet computer | android tablet
iPad | IPad | apple tablet
E-reader | Amazon Kindle | kindle
Television | Television set | tv, smart tv, led tv
Projector | Video projector | projector
Soundbar | Soundbar | home theatre
Bluetooth speaker | Bluetooth speaker | speaker, jbl
Home theatre | Home cinema | home theater
Camera | Digital camera | dslr, mirrorless
Action camera | Action camera | gopro
Drone | Unmanned aerial vehicle | quadcopter, dji
Gaming console | Gamepad | playstation, ps5, xbox, nintendo switch
Game controller | Gamepad | joystick, controller
VR headset | Virtual reality headset | vr, oculus, quest
Power bank | - | powerbank, portable charger
Webcam | Webcam | camera
Microphone | Microphone | mic
Graphics card | Graphics card | gpu
Smart home speaker | Smart speaker | alexa, google home
Electric toothbrush | Electric toothbrush | sonic toothbrush
`,
  },
  {
    category: 'Fashion',
    type: 'WANT',
    items: `
Shoes | Shoe | shoes
Running shoes | Sneakers | sneakers, trainers, nike, adidas
Sandals | Sandal | slippers, flip flops
Formal shoes | Dress shoe | office shoes, leather shoes
Heels | High-heeled shoe | high heels
Boots | Boot | boots
Shirt | Shirt | office shirt, formal shirt
T-shirt | T-shirt | tshirt, tee
Polo shirt | Polo shirt | polo
Jeans | Jeans | denim
Trousers | Trousers | pants, slacks
Shorts | Bermuda shorts | short pants
Dress | Dress | frock
Skirt | - | skirt
Blouse | Blouse | top
Saree | Sari | sari, osariya
Sarong | Sarong | sarama, lungi
Kurta | Kurta | salwar, shalwar
Suit | Suit | blazer, coat
Jacket | Jacket | hoodie, windcheater
Sweater | Sweater | jumper, cardigan
Raincoat | Raincoat | rain coat
Umbrella | Umbrella | kudaya
Underwear | Undergarment | innerwear, bra, briefs
Socks | Sock | socks
Pyjamas | - | nightwear, sleepwear
Gym clothes | Sportswear (activewear) | sportswear, activewear
Swimwear | - | swimsuit, swimming costume
Handbag | Handbag | purse, ladies bag
Wallet | Wallet | purse
Backpack | Backpack | bag
Travel bag | Luggage | suitcase, luggage
Belt | Belt (clothing) | belt
Cap | Baseball cap | hat, cap
Wristwatch | Watch | watch, casio, titan
Sunglasses | Sunglasses | shades
Jewellery | Jewellery | gold, necklace, bangles, chain
Earrings | Earring | earring
Ring | Ring (jewellery) | wedding ring, gold ring
Hair accessories | Hair tie | hair clips, bands
Tailoring | Tailor | stitching, alterations
`,
  },
  {
    category: 'Hobbies',
    type: 'WANT',
    items: `
Guitar | Guitar | acoustic guitar
Electric guitar | Fender Stratocaster | guitar
Keyboard (piano) | Electronic keyboard | piano, organ
Violin | Violin | violin
Drum kit | Drum kit | drums
Ukulele | Ukulele | ukulele
Music lessons | Music lesson | piano class, guitar class
Bicycle | Bicycle | bike, cycle, mountain bike
Football | Ball (association football) | ball
Cricket bat | Cricket | bat
Cricket ball | Cricket ball | ball
Badminton racket | Badminton | shuttlecock, racket
Tennis racket | Racket (sports equipment) | tennis
Basketball | Basketball (ball) | ball
Volleyball | Volleyball (ball) | ball
Table tennis | Table tennis | ping pong
Carrom board | Carrom | carrom
Chess set | Chess | chess
Yoga mat | Yoga mat | yoga
Dumbbells | Dumbbell | weights
Treadmill | Treadmill | running machine
Swimming lessons | Swimming lessons | swimming class
Fishing gear | Fishing rod | fishing
Camping gear | Camping | tent, camping
Hiking backpack | Backpack | hiking
Paint set | Paint | colours, acrylic, watercolour
Canvas | Canvas | painting canvas
Sketchbook | Sketchbook | drawing book
Sewing machine | - | sewing
Knitting yarn | Yarn | wool, crochet
Gardening seeds | Seed | seeds, plants
Indoor plants | Houseplant | plants, pot plants
Photography lessons | Photography | photo class
Model kit | Scale model | models
Craft supplies | Handicraft | crafts, glue
Novel | - | story book, fiction
Comics | Comic book | manga
Dance class | Dance studio | dancing class
Martial arts class | - | karate, taekwondo
`,
  },
  {
    category: 'Gifts',
    type: 'WANT',
    items: `
Birthday gift | Gift | present
Wedding gift | Wedding | wedding present
Flowers | Rose | bouquet, roses
Chocolates | Chocolate | chocolate box
Gift card | Gift card | voucher
Greeting card | Greeting card | card
Gift wrapping | Gift wrapping | wrapping paper
Anniversary gift | - | anniversary
Christmas gifts | Christmas gift | xmas
Avurudu gifts | Sinhalese New Year | new year, avurudu
Donation | Donation | charity, dana, alms
Temple offering | Buddhist temple | pinkama, dansala
Church offering | Church (building) | offering
`,
  },
  {
    category: 'Travel',
    type: 'WANT',
    items: `
Weekend trip | Ella, Sri Lanka | trip, tour, ella, kandy, nuwara eliya
Beach holiday | Beach | mirissa, galle, beach trip
Hotel stay | Hotel | hotel, room
Villa | Villa | holiday home, bungalow
Flight ticket | Airliner | flight, air ticket, plane
Visa fees | Travel visa | visa
Passport | Passport | passport fees
Travel insurance | Travel insurance | insurance
Suitcase | Suitcase | luggage
Safari | Safari | yala, wilpattu, jeep safari
Train to Ella | Nine Arch Bridge | scenic train
Pilgrimage | - | sri pada, adam's peak, kataragama
Foreign currency | - | dollars, exchange
Sim card abroad | SIM card | roaming
Tour guide | Tour guide | guide
Camping trip | Camping | camp
Car rental | Car rental | rent a car
`,
  },
  {
    category: 'Loans',
    type: 'NEED',
    items: `
Personal loan payment | - | loan installment, emi
Credit card bill | Credit card | card bill
Leasing payment | Lease | vehicle lease, leasing
Pawning | Pawnbroker | pawn, ukas
Microfinance loan | Microfinance | micro loan
`,
  },
  {
    category: 'Insurance',
    type: 'NEED',
    items: `
Life insurance | - | policy, aia, ceylinco
Medical insurance premium | - | medical policy
`,
  },
  {
    category: 'Other',
    type: 'WANT',
    items: `
Tax payment | - | income tax, apit
Bank charges | Bank | bank fee, service charge
Legal fees | Lawyer | lawyer, notary
Funeral expenses | - | funeral
Wedding expenses | Wedding | wedding
Photocopy | Photocopier | photocopies
Courier | Courier | delivery, domex, parcel
Post office | Post office | stamps, post
Cigarettes | Cigarette | smoke
Alcohol | Alcoholic beverage | arrack, beer, liquor
Lottery ticket | Lottery | lottery, dlb, nlb
`,
  },
];
