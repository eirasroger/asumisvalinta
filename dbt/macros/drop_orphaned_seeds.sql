{#
    Statements that drop tables in the seeds schema which no seed of the project defines, so a
    removed seed does not stay in a warehouse restored from an earlier release. Used as an
    on-run-start hook; renders nothing when there is nothing to drop.
#}
{% macro drop_orphaned_seeds() %}
    {% if execute %}
        {% set seeds = graph.nodes.values() | selectattr('resource_type', 'equalto', 'seed') | list %}
        {% if seeds %}
            {% set names = seeds | map(attribute='alias') | map('lower') | list %}
            {% set schema = api.Relation.create(database=seeds[0].database, schema=seeds[0].schema) %}
            {% set orphans = [] %}
            {% for row in list_relations_without_caching(schema) %}
                {% if row['name'] | lower not in names %}
                    {% do orphans.append(api.Relation.create(
                        database=row['database'], schema=row['schema'], identifier=row['name']
                    )) %}
                {% endif %}
            {% endfor %}
            {% for orphan in orphans %}
                {% do log('Dropping ' ~ orphan ~ ', which no seed defines', info=true) %}
                drop table if exists {{ orphan }};
            {% endfor %}
            {# dbt rolls back the hook's transaction, so the drops are committed here. #}
            {% if orphans %}commit;{% endif %}
        {% endif %}
    {% endif %}
{% endmacro %}
