let craftItem = {
        products: [
                ...season0.sets.flatMap(set =>
                                set.products.map(product => ({
                                                ...product,
                                                setName: product.setName || set.setName,
                                                season: season0.season
                                }))
                ),
		...season1.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season1.season
				}))
		),
		...season2.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season2.season
				}))
		),
                ...season3.sets.flatMap(set =>
                                set.products.map(product => ({
                                                ...product,
                                                setName: product.setName || set.setName,
                                                season: season3.season
                                }))
                ),
                ...seasonctw.sets.flatMap(set =>
                                set.products.map(product => ({
                                                ...product,
                                                setName: product.setName || set.setName,
                                                season: seasonctw.season
                                }))
                ),
                ...season4.sets.flatMap(set =>
                                set.products.map(product => ({
                                                ...product,
                                                setName: product.setName || set.setName,
                                                season: season4.season
				}))
		),
		...season5.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season5.season
				}))
		),
		...season6.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season6.season
				}))
		),
		...season7.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season7.season
				}))
		),
		...season8.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season8.season
				}))
		),
		...season9.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season9.season
				}))
		),
		...season10.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season10.season
				}))
		),
		...season11.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season11.season
				}))
		),
		...season12.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season12.season
				}))
		)
        ]
};

const seasonsMap = {
  0: season0,
  1: season1,
  2: season2,
  3: season3,
  4: season4,
  5: season5,
  6: season6,
  7: season7,
  8: season8,
  9: season9,
  10: season10,
  11: season11,
  12: season12,
};

const extraProducts = [];

const CTW_SET_NAME = 'Ceremonial Targaryen Warlord';
const CTW_SEASON = season3.season;

if (typeof window !== 'undefined') {
  window.CTW_SET_NAME = CTW_SET_NAME;
}

craftItem.products = craftItem.products.map(product => {
  if (product.setName === CTW_SET_NAME) {
    return { ...product, season: CTW_SEASON };
  }
  return product;
});

craftItem.products.forEach(product => {
  if (product.level === 25 && product.season !== 0) {
    const extraLevels = seasonsMap[product.season]?.extraLevels;
    if (extraLevels) {
      Object.entries(extraLevels).forEach(([lvl, amt]) => {
        const ratio = amt / 1200;
        const mats = {};
        Object.entries(product.materials).forEach(([mat, val]) => {
          mats[mat] = val * ratio;
        });
        extraProducts.push({
          ...product,
          level: parseInt(lvl, 10),
          materials: mats,
        });
      });
    }
  }
});

craftItem.products.push(...extraProducts);

window.seasons = Object.values(seasonsMap);
