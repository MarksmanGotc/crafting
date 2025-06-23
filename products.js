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

window.seasons = [season0, season1, season2, season3, season4, season5, season6, season7, season8, season9, season10, season11, season12];
