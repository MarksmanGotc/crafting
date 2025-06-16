let craftItem = {
	products: [
		...season0.sets.flatMap(set =>
				set.products.map(product => ({
						...product,
						setName: product.setName || set.setName,
						season: season0.season
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

window.seasons = [season0, season8, season9, season10, season11, season12];
