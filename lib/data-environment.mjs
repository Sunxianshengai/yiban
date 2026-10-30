export function dataEnvironment(env=process.env){
  if(env.VERCEL)return env.VERCEL_ENV==='production'?'production':'preview';
  if(env.NODE_ENV==='test'||env.YIBAN_DATA_ENV==='test')return 'test';
  return 'development';
}
export function assertStorageEnvironment(env=process.env){
  const environment=dataEnvironment(env);
  if(environment==='test'&&!env.YIBAN_DATA_DIR&&!env.DATABASE_URL)throw Error('测试必须设置独立的 YIBAN_DATA_DIR，禁止使用默认用户数据目录');
  if(env.DATABASE_URL&&environment!=='production'&&env.YIBAN_DATABASE_ENVIRONMENT!==environment)throw Error(`非正式环境拒绝连接未标记的数据库：请使用独立 ${environment} 数据库并配置 YIBAN_DATABASE_ENVIRONMENT`);
  return environment;
}
export function verifyEnvironmentBinding(binding,environment,{remote=false}={}){
  if(binding&&binding.environment!==environment)throw Error(`数据库已绑定 ${binding.environment}，拒绝 ${environment} 环境访问`);
  // A cloned production database retains its production binding. Only a fresh
  // or explicitly provisioned test database can be used by a preview instance.
  if(!binding&&remote&&environment!=='production')throw Error('测试数据库尚未初始化环境标记，请先运行隔离数据库预检工具');
}
