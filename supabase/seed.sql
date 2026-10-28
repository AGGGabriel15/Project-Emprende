-- Catarina Market · datos base (idempotente)

insert into public.departments (id, name) values
  (1, 'Boaco'), (2, 'Carazo'), (3, 'Chinandega'), (4, 'Chontales'), (5, 'Estelí'),
  (6, 'Granada'), (7, 'Jinotega'), (8, 'León'), (9, 'Madriz'), (10, 'Managua'),
  (11, 'Masaya'), (12, 'Matagalpa'), (13, 'Nueva Segovia'), (14, 'Río San Juan'),
  (15, 'Rivas'), (16, 'Costa Caribe Norte'), (17, 'Costa Caribe Sur')
on conflict (id) do update set name = excluded.name;

insert into public.municipalities (id, department_id, name)
select row_number() over (order by d, ord), d, n
from (values
  (1, 1, 'Boaco'), (1, 2, 'Camoapa'), (1, 3, 'San José de los Remates'), (1, 4, 'San Lorenzo'),
  (1, 5, 'Santa Lucía'), (1, 6, 'Teustepe'),
  (2, 1, 'Diriamba'), (2, 2, 'Dolores'), (2, 3, 'El Rosario'), (2, 4, 'Jinotepe'),
  (2, 5, 'La Conquista'), (2, 6, 'La Paz de Carazo'), (2, 7, 'San Marcos'), (2, 8, 'Santa Teresa'),
  (3, 1, 'Chichigalpa'), (3, 2, 'Chinandega'), (3, 3, 'Cinco Pinos'), (3, 4, 'Corinto'),
  (3, 5, 'El Realejo'), (3, 6, 'El Viejo'), (3, 7, 'Posoltega'), (3, 8, 'Puerto Morazán'),
  (3, 9, 'San Francisco del Norte'), (3, 10, 'San Pedro del Norte'), (3, 11, 'Santo Tomás del Norte'),
  (3, 12, 'Somotillo'), (3, 13, 'Villanueva'),
  (4, 1, 'Acoyapa'), (4, 2, 'Comalapa'), (4, 3, 'Cuapa'), (4, 4, 'El Coral'), (4, 5, 'Juigalpa'),
  (4, 6, 'La Libertad'), (4, 7, 'San Pedro de Lóvago'), (4, 8, 'Santo Domingo'), (4, 9, 'Santo Tomás'),
  (4, 10, 'Villa Sandino'),
  (5, 1, 'Condega'), (5, 2, 'Estelí'), (5, 3, 'La Trinidad'), (5, 4, 'Pueblo Nuevo'),
  (5, 5, 'San Juan de Limay'), (5, 6, 'San Nicolás'),
  (6, 1, 'Diriá'), (6, 2, 'Diriomo'), (6, 3, 'Granada'), (6, 4, 'Nandaime'),
  (7, 1, 'El Cuá'), (7, 2, 'Jinotega'), (7, 3, 'La Concordia'), (7, 4, 'San José de Bocay'),
  (7, 5, 'San Rafael del Norte'), (7, 6, 'San Sebastián de Yalí'), (7, 7, 'Santa María de Pantasma'),
  (7, 8, 'Wiwilí de Jinotega'),
  (8, 1, 'Achuapa'), (8, 2, 'El Jicaral'), (8, 3, 'El Sauce'), (8, 4, 'La Paz Centro'),
  (8, 5, 'Larreynaga'), (8, 6, 'León'), (8, 7, 'Nagarote'), (8, 8, 'Quezalguaque'),
  (8, 9, 'Santa Rosa del Peñón'), (8, 10, 'Telica'),
  (9, 1, 'Las Sabanas'), (9, 2, 'Palacagüina'), (9, 3, 'San José de Cusmapa'),
  (9, 4, 'San Juan de Río Coco'), (9, 5, 'San Lucas'), (9, 6, 'Somoto'), (9, 7, 'Telpaneca'),
  (9, 8, 'Totogalpa'), (9, 9, 'Yalagüina'),
  (10, 1, 'Ciudad Sandino'), (10, 2, 'El Crucero'), (10, 3, 'Managua'), (10, 4, 'Mateare'),
  (10, 5, 'San Francisco Libre'), (10, 6, 'San Rafael del Sur'), (10, 7, 'Ticuantepe'),
  (10, 8, 'Tipitapa'), (10, 9, 'Villa El Carmen'),
  (11, 1, 'Catarina'), (11, 2, 'La Concepción'), (11, 3, 'Masatepe'), (11, 4, 'Masaya'),
  (11, 5, 'Nandasmo'), (11, 6, 'Nindirí'), (11, 7, 'Niquinohomo'), (11, 8, 'San Juan de Oriente'),
  (11, 9, 'Tisma'),
  (12, 1, 'Ciudad Darío'), (12, 2, 'El Tuma - La Dalia'), (12, 3, 'Esquipulas'), (12, 4, 'Matagalpa'),
  (12, 5, 'Matiguás'), (12, 6, 'Muy Muy'), (12, 7, 'Rancho Grande'), (12, 8, 'Río Blanco'),
  (12, 9, 'San Dionisio'), (12, 10, 'San Isidro'), (12, 11, 'San Ramón'), (12, 12, 'Sébaco'),
  (12, 13, 'Terrabona'),
  (13, 1, 'Ciudad Antigua'), (13, 2, 'Dipilto'), (13, 3, 'El Jícaro'), (13, 4, 'Jalapa'),
  (13, 5, 'Macuelizo'), (13, 6, 'Mozonte'), (13, 7, 'Murra'), (13, 8, 'Ocotal'), (13, 9, 'Quilalí'),
  (13, 10, 'San Fernando'), (13, 11, 'Santa María'), (13, 12, 'Wiwilí de Nueva Segovia'),
  (14, 1, 'El Almendro'), (14, 2, 'El Castillo'), (14, 3, 'Morrito'), (14, 4, 'San Carlos'),
  (14, 5, 'San Juan de Nicaragua'), (14, 6, 'San Miguelito'),
  (15, 1, 'Altagracia'), (15, 2, 'Belén'), (15, 3, 'Buenos Aires'), (15, 4, 'Cárdenas'),
  (15, 5, 'Moyogalpa'), (15, 6, 'Potosí'), (15, 7, 'Rivas'), (15, 8, 'San Jorge'),
  (15, 9, 'San Juan del Sur'), (15, 10, 'Tola'),
  (16, 1, 'Bonanza'), (16, 2, 'Mulukukú'), (16, 3, 'Prinzapolka'), (16, 4, 'Puerto Cabezas'),
  (16, 5, 'Rosita'), (16, 6, 'Siuna'), (16, 7, 'Waslala'), (16, 8, 'Waspam'),
  (17, 1, 'Bluefields'), (17, 2, 'Corn Island'), (17, 3, 'Desembocadura de Río Grande'),
  (17, 4, 'El Ayote'), (17, 5, 'El Rama'), (17, 6, 'El Tortuguero'), (17, 7, 'Kukra Hill'),
  (17, 8, 'La Cruz de Río Grande'), (17, 9, 'Laguna de Perlas'), (17, 10, 'Muelle de los Bueyes'),
  (17, 11, 'Nueva Guinea'), (17, 12, 'Paiwas')
) as m (d, ord, n)
on conflict (id) do update set department_id = excluded.department_id, name = excluded.name;

insert into public.platform_categories (name, slug, icon, sort_order) values
  ('Artesanías', 'artesanias', 'palette', 1),
  ('Plantas', 'plantas', 'sprout', 2),
  ('Flores', 'flores', 'flower-2', 3),
  ('Decoración', 'decoracion', 'lamp', 4),
  ('Accesorios', 'accesorios', 'gem', 5),
  ('Otro', 'otro', 'package', 6)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order;

insert into public.platform_settings (key, value) values
  ('commission_rate', '0.08'),
  ('pending_payment_minutes', '30'),
  ('support_email', '"soporte@catarinamarket.local"'),
  ('support_whatsapp', '"+50588880000"')
on conflict (key) do nothing;
