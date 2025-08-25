/*
  Script de seed pour Fairway Progress Hub
  - Crée des utilisateurs (admin, instructor, player) si manquants
  - Crée 3 parcours (Étape 1/2/3) et leurs leçons (9/6/9)
  - Affecte l'instructor propriétaire aux cours
  - Idempotent: utilise upsert et mises à jour par titre/ordre

  Sécurité:
  - Aucun secret en dur: les mots de passe peuvent être fournis via variables d'environnement
  - Si absents, des mots de passe aléatoires sont générés et affichés dans la console (à usage dev)
*/

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Answer = require('../models/Answer');

async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is required in environment');
  }
  await mongoose.connect(uri, { autoIndex: true });
}

function randomPassword() {
  return crypto.randomBytes(10).toString('base64url');
}

// Mise en forme Title Case rudimentaire (FR): capitalise chaque mot hors mots courts
function titleCaseFR(str) {
  if (!str) return str;
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'sur', 'au', 'aux', 'à', 'en', 'pour', 'par', "d'"]);
  return str
    .split(/\s+/)
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i > 0 && small.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(' ')
    // Harmonisation espaces autour de '/'
    .replace(/\s*\/\s*/g, ' / ')
    // N° -> N°
    .replace(/n°/gi, 'N°');
}

function containsExplication(popup) {
  return typeof popup === 'string' && /(explication)/i.test(popup);
}

// Détecte si une description semble être un simple placeholder (à écraser)
function isPlaceholderDescription(str) {
  if (!str) return true;
  const s = String(str).trim().toLowerCase();
  if (s.length <= 3) return true; // "-", "n/a", "tbd"
  const patterns = [
    'placeholder', 'à venir', 'a venir', 'todo', 'tbd', 'lorem ipsum', 'draft',
    'en construction', 'coming soon', 'wip', '—', '-', '...', 'texte à définir',
  ];
  return patterns.some(p => s.includes(p));
}

// Paragraphe spécifique au titre (adaptation du contenu au thème de la leçon)
function specificParagraphForTitle(title) {
  const t = title.toLowerCase();
  if (t.includes('grip')) {
    return "Techniques de grip : Vardon (overlap) pour la stabilité, Interlock pour les mains plus petites, et ten‑finger (baseball) pour débuter en douceur. Gardez une pression légère (4/10), poignets souples et faces des mains orientées de part et d’autre du manche. Un grip neutre favorise un chemin de club centré et une face square à l’impact.";
  }
  if (t.includes('placement de la balle') || t.includes('balle')) {
    return "Placement de balle : devant le pied arrière pour les wedges, centre de stance pour fers moyens, légèrement vers l’avant pour les bois/driver. Conservez l’axe sternum‑balle cohérent, poids réparti 55/45, et vérifiez l’alignement pieds‑hanches‑épaules parallèle à la ligne de jeu.";
  }
  if (t.includes('posture')) {
    return "Posture : charnière de hanches (hinge), dos gainé mais relâché, légère flexion de genoux et poids équilibré sur les plantes de pieds. Les bras pendent naturellement, le menton dégagé pour faciliter la rotation, et la colonne forme un angle constant tout au long du swing.";
  }
  if (t.includes('putt')) {
    return "Putt court : épaules comme moteur (mouvement pendulaire), face de putter square à l’impact et rythme constant. Choisissez une routine simple (lecture, alignement, coup d’essai) et visez une sortie de balle sur la ligne choisie avec un finish stable.";
  }
  if (t.includes('approche') || t.includes('petit jeu')) {
    return "Approche/petit jeu : sélectionnez le loft selon la trajectoire souhaitée (low‑run vs. fly‑land‑stop). Focalisez un point de chute précis, poids légèrement à gauche, mains en avant, et un contact net qui priorise la régularité à la puissance.";
  }
  if (t.includes('sécurité')) {
    return "Sécurité appliquée : respectez les distances, annoncez ‘Fore!’ si nécessaire, vérifiez l’environnement avant chaque swing, et tenez compte du vent et des pentes. La vigilance et la communication sont prioritaires pour la sécurité de tous.";
  }
  if (t.includes('rythme de jeu')) {
    return "Rythme de jeu : pratiquez le ‘ready golf’, préparez votre coup en avançant, limitez les essais superflus et anticipez le club suivant. Une cadence fluide améliore l’expérience de tout le groupe et diminue la pression individuelle.";
  }
  if (t.includes('procédure de passage')) {
    return "Procédure de passage : laissez jouer le groupe plus rapide, sécurisez la zone, signalez votre intention et reprenez le jeu sans retarder les suivants. Cette politesse sportive fluidifie la circulation sur le parcours.";
  }
  if (t.includes('stableford')) {
    return "Stableford : comprenez le barème des points, adaptez votre stratégie trou par trou, et jouez en sécurité quand un bogey vous garantit encore des points. Gardez un tempo régulier et évitez les doubles erreurs après un coup manqué.";
  }
  if (t.includes('couleurs de départ') || t.includes('départ')) {
    return "Couleurs de départ : choisissez vos tees selon l’index, la longueur de frappe et les conditions. Un départ adapté améliore le plaisir de jeu et la sécurité, tout en favorisant un score représentatif de votre niveau.";
  }
  if (t.includes('réservation')) {
    return "Prise de réservation : vérifiez la disponibilité, constituez votre partie, respectez les créneaux et les consignes du club. Anticipez vos horaires pour éviter toute précipitation et préserver un rythme de jeu serein.";
  }
  if (t.includes('test de frappe')) {
    return "Test de frappe : sur tee, ajustez la hauteur (moitié de la balle au‑dessus de la face pour le driver), privilégiez un contact centré et observez la trajectoire. Sur herbe, cherchez un contact balle‑puis‑sol, avec un finish équilibré et contrôlé.";
  }
  return "Points clés : définissez un objectif clair, contrôlez l’alignement, stabilisez les appuis et suivez une routine courte. Mesurez vos progrès avec des critères simples (contact, direction, rythme) et ajustez un seul paramètre à la fois.";
}

// Génère ~1/2 page de texte pédagogique (≈150–200 mots) selon le titre et l'étape
function buildLessonDescription(title, stepLabel) {
  const t = titleCaseFR(title);
  const step = stepLabel;
  const p1 = `Objectif de la leçon « ${t} » (${step}) : comprendre les fondamentaux, adopter une gestuelle sûre et efficace, et savoir s’auto‑corriger. Nous cadrons le contexte (situation de jeu, risques, intention), puis détaillons posture, appuis et repères visuels. Privilégiez une exécution fluide à la force brute : la régularité et la qualité de contact priment sur la puissance.`;
  const p2 = specificParagraphForTitle(t);
  const p3 = `Erreurs fréquentes : tension dans les mains, rythme précipité, alignement approximatif ou regard instable. Pour progresser, adoptez une routine courte (respiration, alignement, point de focalisation), filmez 2–3 essais et comparez avec les repères ci‑dessus. Exercice suggéré : 3 × 10 répétitions en focalisant successivement (1) posture, (2) chemin de club, (3) final équilibré. Critères de validation : contact propre, direction contrôlée et rythme constant sur au moins 7 coups sur 10.`;
  const p4 = `Conseils du pro : fixez des objectifs mesurables (ex. zone de 2 m au putting, point de chute en approche, angle d’attaque neutre sur tapis/tee), notez vos ressentis et n’ajustez qu’un paramètre à la fois. Consolidez ces bases avant d’ajouter de la complexité (pentes, vent, lies variés).`;
  return [p1, p2, p3, p4].join('\n\n');
}

async function ensureUser({ email, password, role, firstName, lastName }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, password, role, firstName, lastName, isEmailVerified: true });
    console.log(`✔ Created ${role} user: ${email}`);
  } else {
    // Ensure role is correct (do not overwrite password)
    if (user.role !== role) {
      user.role = role;
      await user.save();
      console.log(`ℹ Updated role for ${email} -> ${role}`);
    }
    console.log(`✓ User exists: ${email}`);
  }
  return user;
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || randomPassword();
  const instructorEmail = process.env.SEED_INSTRUCTOR_EMAIL || 'instructor@example.local';
  const instructorPassword = process.env.SEED_INSTRUCTOR_PASSWORD || randomPassword();
  const playerEmail = process.env.SEED_PLAYER_EMAIL || 'player@example.local';
  const playerPassword = process.env.SEED_PLAYER_PASSWORD || randomPassword();
  // Second joueur pour tests d'indépendance de progression
  const player2Email = process.env.SEED_PLAYER2_EMAIL || 'player2@example.local';
  const player2Password = process.env.SEED_PLAYER2_PASSWORD || randomPassword();

  if (!process.env.SEED_ADMIN_PASSWORD) console.log(`Generated admin password for ${adminEmail}: ${adminPassword}`);
  if (!process.env.SEED_INSTRUCTOR_PASSWORD) console.log(`Generated instructor password for ${instructorEmail}: ${instructorPassword}`);
  if (!process.env.SEED_PLAYER_PASSWORD) console.log(`Generated player password for ${playerEmail}: ${playerPassword}`);
  if (!process.env.SEED_PLAYER2_PASSWORD) console.log(`Generated player2 password for ${player2Email}: ${player2Password}`);

  const admin = await ensureUser({ email: adminEmail, password: adminPassword, role: 'admin', firstName: 'Admin', lastName: 'User' });
  const instructor = await ensureUser({ email: instructorEmail, password: instructorPassword, role: 'instructor', firstName: 'Pro', lastName: 'Instructor' });
  const player = await ensureUser({ email: playerEmail, password: playerPassword, role: 'player', firstName: 'Demo', lastName: 'Player' });
  const player2 = await ensureUser({ email: player2Email, password: player2Password, role: 'player', firstName: 'Demo2', lastName: 'Player' });

  // Assigner l'instructeur aux joueurs si non défini
  const players = [player, player2].filter(Boolean);
  for (const p of players) {
    if (!p.assignedInstructor || String(p.assignedInstructor) !== String(instructor._id)) {
      p.assignedInstructor = instructor._id;
      await p.save();
      console.log(`↺ Updated assignedInstructor for ${p.email} -> ${instructor.email}`);
    }
  }

  return { admin, instructor, player, player2 };
}

async function upsertCourseWithLessons({ title, description, instructor, lessons = [] }) {
  // Upsert course by title
  let course = await Course.findOne({ title });
  if (!course) {
    course = await Course.create({ title, description, instructor: instructor._id, isPublished: true });
    console.log(`✔ Created course: ${title}`);
  } else {
    // Keep instructor, description and publish state updated
    course.instructor = instructor._id;
    course.description = description;
    course.isPublished = true;
    await course.save();
    console.log(`✓ Course exists: ${title}`);
  }

  // Create/update lessons from explicit spec
  const lessonIds = [];
  for (let i = 0; i < lessons.length; i++) {
    const order = i + 1;
    const spec = lessons[i];
    const lessonTitle = titleCaseFR(spec.title);
    const validationMode = spec.validationMode || 'read';
    const shouldExplain = containsExplication(spec.popup);
    // Génération SYSTÉMATIQUE du texte explicatif (~150–200 mots) ou usage de la description fournie
    // La seed est source de vérité: on écrase toujours titre + description
    const description = shouldExplain
      ? buildLessonDescription(lessonTitle, title)
      : (spec.description || '');

    const update = {
      title: lessonTitle,
      order,
      validationMode,
      description,
      course: course._id,
    };

    const lesson = await Lesson.findOneAndUpdate(
      { course: course._id, order },
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    lessonIds.push(lesson._id);
  }

  // Keep lessons array synced
  course.lessons = lessonIds;
  await course.save();

  console.log(`↪ Seeded ${lessonIds.length} lessons for course: ${title}`);

  return course;
}

async function seedCourses(instructor) {
  const step1 = {
    title: 'Étape 1 — Débutant',
    description: 'Parcours débutant',
    lessons: [
      { title: 'Prise en main du grip', validationMode: 'pro', popup: 'explication' },
      { title: 'Placement de la balle', validationMode: 'pro', popup: 'explication' },
      { title: 'Posture', validationMode: 'pro', popup: 'explication' },
      { title: 'Putt court', validationMode: 'pro', popup: 'explication' },
      { title: 'Approche', validationMode: 'pro', popup: 'explication' },
      { title: 'Étiquette et sécurité sur le parcours', validationMode: 'pro', popup: 'explication' },
      { title: 'Test de frappe sur herbe / tee', validationMode: 'pro', popup: 'explication' },
      { title: 'Présentation du promeneur', validationMode: 'read', popup: 'video' },
      { title: 'QCM Étiquette et sécurité', validationMode: 'qcm', popup: 'video qcm' },
    ],
  };

  const step2 = {
    title: 'Étape 2 — Promeneur',
    description: 'Parcours promeneur',
    lessons: [
      { title: 'Statut du promeneur', validationMode: 'read', popup: 'pdf' },
      { title: 'QCM Rythme de jeu', validationMode: 'qcm', popup: 'video qcm' },
      { title: 'Procédure de passage', validationMode: 'read', popup: 'explication' },
      { title: 'Test de frappe N°2', validationMode: 'pro', popup: 'explication' },
      { title: 'Rythme de jeu', validationMode: 'pro', popup: 'explication' },
      { title: 'Test petit jeu', validationMode: 'pro', popup: 'explication' },
    ],
  };

  const step3 = {
    title: 'Étape 3 — Parcours',
    description: 'Parcours 9 trous',
    lessons: [
      { title: 'Informations règles', validationMode: 'read', popup: 'video' },
      { title: 'Sécurité appliquée', validationMode: 'pro', popup: 'explication' },
      { title: 'Infos formules de jeu', validationMode: 'read', popup: 'doc/video' },
      { title: 'Stableford', validationMode: 'pro', popup: 'explication video' },
      { title: 'Respect des couleurs de départ', validationMode: 'pro', popup: 'doc et video' },
      { title: 'Test petit jeu', validationMode: 'pro', popup: 'explication' },
      { title: 'Test de frappe', validationMode: 'pro', popup: 'explication' },
      { title: 'Prise de réservation', validationMode: 'read', popup: 'doc / explication' },
      { title: 'QCM Formule de jeu', validationMode: 'qcm', popup: '' },
    ],
  };

  const courses = [];
  for (const cfg of [step1, step2, step3]) {
    const course = await upsertCourseWithLessons({ ...cfg, instructor });
    courses.push(course);
  }
  return courses;
}

// --- Seed des QCM pour les leçons en mode 'qcm' ---
// Idempotent: s'appuie sur (quiz, question, answer) identifiés par (lesson, text)
async function ensureRefInArray(doc, field, id) {
  const arr = (doc[field] || []).map(String);
  if (!arr.includes(String(id))) {
    doc[field].push(id);
    await doc.save();
    return true;
  }
  return false;
}

async function seedQuizzesForQcmLessons() {
  const qcmLessons = await Lesson.find({ validationMode: 'qcm' });

  const defaultQuestions = [
    {
      text: "Sécurité: quelles affirmations sont vraies ?",
      answers: [
        { text: "Annoncer 'Fore!' en cas de balle dangereuse", isCorrect: true },
        { text: "Swinguer sans vérifier la zone devant soi", isCorrect: false },
        { text: "Vérifier l'environnement avant chaque coup", isCorrect: true },
        { text: "Ignorer le vent et les pentes pour gagner du temps", isCorrect: false },
      ],
    },
    {
      text: "Rythme de jeu: bonnes pratiques",
      answers: [
        { text: "Pratiquer le 'ready golf' lorsque c'est sûr", isCorrect: true },
        { text: "Attendre d'être au départ pour choisir son club", isCorrect: false },
        { text: "Préparer son coup en avançant", isCorrect: true },
        { text: "Multiplier les coups d'essai même quand on est prêt", isCorrect: false },
      ],
    },
  ];

  for (const lesson of qcmLessons) {
    // 1) Quiz par leçon (unique)
    let quiz = await Quiz.findOne({ lesson: lesson._id });
    if (!quiz) {
      quiz = await Quiz.create({
        title: `QCM — ${lesson.title}`,
        passingScore: 70,
        lesson: lesson._id,
        questions: [],
      });
      console.log(`✔ Created quiz for lesson: ${lesson.title}`);
    } else {
      // Optionnel: synchroniser titre/passingScore si nécessaire
      let updated = false;
      const desiredTitle = `QCM — ${lesson.title}`;
      if (quiz.title !== desiredTitle) { quiz.title = desiredTitle; updated = true; }
      if (typeof quiz.passingScore !== 'number') { quiz.passingScore = 70; updated = true; }
      if (updated) { await quiz.save(); console.log(`↺ Updated quiz meta for lesson: ${lesson.title}`); }
    }

    // 2) Questions + Réponses (multi-réponses possibles)
    for (const qSpec of defaultQuestions) {
      let question = await Question.findOne({ quiz: quiz._id, text: qSpec.text });
      if (!question) {
        question = await Question.create({ quiz: quiz._id, text: qSpec.text, answers: [] });
        console.log(`  ↳ Created question: ${qSpec.text}`);
      }

      // Assure le lien parent -> question
      await ensureRefInArray(quiz, 'questions', question._id);

      for (const aSpec of qSpec.answers) {
        // Upsert par (question, text)
        let answer = await Answer.findOneAndUpdate(
          { question: question._id, text: aSpec.text },
          { $set: { isCorrect: aSpec.isCorrect, question: question._id } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        // Assure le lien parent -> réponse
        await ensureRefInArray(question, 'answers', answer._id);
      }
    }
  }
}

async function main() {
  console.log('Starting seed...');
  await connect();
  const { instructor } = await seedUsers();
  await seedCourses(instructor);
  await seedQuizzesForQcmLessons();
  console.log('Seed completed successfully.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
