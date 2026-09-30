select
    room_types.room_type,
    room_types.room_type_name,
    room_types.room_type_name_fi,
    room_types.sort_order
from (
    values
    ('one_room', 'One-room flat', 'yksiö', 1),
    ('two_room', 'Two-room flat', 'kaksio', 2),
    ('three_room_plus', 'Flat with three or more rooms', 'kolmio tai suurempi', 3),
    ('all', 'All room types', 'kaikki', 4)
) as room_types (room_type, room_type_name, room_type_name_fi, sort_order)
