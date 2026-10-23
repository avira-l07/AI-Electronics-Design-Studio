"""Server-authoritative product scope. Local modelling remains available without payment."""
from api.security import effective_plan,require_premium

PLANS={'free':{'name':'Free','profiles':1,'features':['local_modelling','mesh_export','engineering_calculations','cloud_projects']},
       'premium':{'name':'Pro','profiles':5,'features':['local_modelling','mesh_export','engineering_calculations','cloud_projects','ai_modelling','team_projects']}}

def entitlements(db,settings,user):return {'plan':effective_plan(db,settings,user).id,'plans':PLANS,'prices_configured':bool(settings.monthly_price and settings.annual_price)}

def require_feature(db,settings,user,feature):
    if feature in ['ai_modelling','team_projects']:require_premium(db,settings,user)
    elif feature not in PLANS['free']['features']:raise ValueError('Unknown product feature')
