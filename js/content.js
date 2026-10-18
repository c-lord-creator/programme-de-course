// Conseils nutrition et récupération, simples et sans régime.

export const ADVICE = [
  {
    id: 'avant',
    icon: '⏰',
    title: 'Avant de courir',
    items: [
      'Mange un repas complet 2 à 3 h avant, ou une petite collation 30 à 60 min avant (banane, compote, pain d\'épices).',
      'Évite les plats gras ou très riches en fibres juste avant : ils pèsent sur l\'estomac.',
      'Bois un verre d\'eau dans l\'heure qui précède.',
      'Le matin à jeun ? C\'est possible pour un footing tranquille de moins de 45 min, pas pour le fractionné.',
    ],
  },
  {
    id: 'pendant',
    icon: '💧',
    title: 'Pendant',
    items: [
      'Moins d\'1 h : l\'eau suffit, et même rien du tout si tu as bien bu avant.',
      'Plus d\'1 h ou forte chaleur : emporte de l\'eau et bois quelques gorgées toutes les 15 à 20 min.',
      'Pas besoin de gels ni de boissons sucrées pour tes séances : ils ajoutent des calories inutiles.',
    ],
  },
  {
    id: 'apres',
    icon: '🍽️',
    title: 'Après',
    items: [
      'Dans l\'heure qui suit, associe protéines et glucides : yaourt + fruit, lait + céréales, œufs + pain complet.',
      'Réhydrate-toi : 1 à 2 grands verres d\'eau, plus s\'il fait chaud.',
      'Ne te « récompense » pas avec de la nourriture : une séance de 45 min brûle environ 350 à 450 kcal, vite compensées.',
      'Les étirements doux et une bonne nuit font plus pour la récupération que n\'importe quel complément.',
    ],
  },
  {
    id: 'quotidien',
    icon: '⚖️',
    title: 'Perdre du poids sans régime',
    items: [
      'Vise une perte de 0,5 kg par semaine maximum : c\'est la vitesse qui dure et qui préserve tes muscles.',
      'Remplis la moitié de ton assiette de légumes, un quart de protéines, un quart de féculents.',
      'Des protéines à chaque repas (œufs, poisson, viande, légumineuses, laitages) aident à garder la satiété.',
      'Mange lentement et sans écran : le signal de satiété arrive après 20 min.',
      'Méfie-toi des calories liquides : sodas, jus, alcool, cafés sucrés.',
      'Garde des aliments plaisir : la régularité compte plus que la perfection.',
      'Le poids fluctue chaque jour (eau, sel, cycle) : regarde la tendance sur 3 à 4 semaines.',
    ],
  },
  {
    id: 'sommeil',
    icon: '😴',
    title: 'Sommeil et récupération',
    items: [
      'Vise 7 à 8 h par nuit : un manque de sommeil augmente la faim et le grignotage.',
      'Garde des horaires réguliers, même le week-end.',
      'Évite les écrans 30 min avant de dormir et les séances intenses juste avant le coucher.',
      'Après une grosse séance, une sieste de 20 min est une excellente récupération.',
    ],
  },
  {
    id: 'course',
    icon: '🏁',
    title: 'Le jour du 10 km',
    items: [
      'Ne teste rien de nouveau : mêmes chaussures, même tenue, même petit-déjeuner qu\'à l\'entraînement.',
      'Petit-déjeuner 2 à 3 h avant : pain ou flocons d\'avoine, banane, un peu de miel, une boisson chaude.',
      'Arrive 45 min avant pour l\'échauffement et les toilettes.',
      'Pars plus lentement que prévu : les 2 premiers km doivent te sembler faciles.',
      'Après la course : boisson, collation salée et sucrée… et ta récompense !',
    ],
  },
];

export const MEALS = [
  {
    title: 'Petits-déjeuners',
    icon: '🥣',
    items: [
      'Flocons d\'avoine, lait ou boisson végétale, fruits rouges, une poignée d\'amandes',
      'Pain complet, œufs brouillés, un fruit',
      'Fromage blanc, muesli sans sucre ajouté, banane',
      'Tartines de pain complet, purée d\'amandes, kiwi',
    ],
  },
  {
    title: 'Déjeuners',
    icon: '🥗',
    items: [
      'Salade de lentilles, légumes croquants, feta, vinaigrette à l\'huile d\'olive',
      'Poulet, riz complet, haricots verts',
      'Bowl quinoa, saumon, avocat, crudités',
      'Omelette aux légumes, pommes de terre au four, salade verte',
    ],
  },
  {
    title: 'Dîners légers',
    icon: '🍲',
    items: [
      'Soupe de légumes maison, tartine de pain complet et fromage',
      'Poisson blanc, légumes rôtis, un peu de semoule',
      'Curry de pois chiches et épinards, riz basmati',
      'Wok de tofu ou crevettes, légumes, nouilles de riz',
    ],
  },
  {
    title: 'Collations',
    icon: '🍎',
    items: [
      'Un fruit + une poignée d\'oléagineux',
      'Yaourt nature + compote sans sucre ajouté',
      'Carré de chocolat noir + quelques amandes',
      'Bâtonnets de carotte et houmous',
    ],
  },
];
