# -*- coding: utf-8 -*-
"""
job - v1 apis
"""

# python 原生import
import json
import logging

# 第三方 import
from django_filters.rest_framework import DjangoFilterBackend
from django.utils.timezone import now
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import get_object_or_404
from rest_framework.exceptions import PermissionDenied

# 项目内 import
from apps.authen.core import UserManager
from apps.job import models, core
from apps.job.api_filters import base as filters
from apps.job.serializers import base as serializers
from apps.codeproj.models import ScanSchemePerm
from apps.codeproj.apimixins import ProjectBaseAPIView
from apps.codeproj import core as codeproj_core
from apps.codeproj.serializers.base import ScanJobCreateSerializer, ScanJobInitSerializer
from apps.authen.backends import ServerAPIAuthentication, TCANodeTokenBackend

from util import errcode
from util.exceptions import CDErrorBase
from util.permissions import RepositoryUserPermission

logger = logging.getLogger(__name__)


class RepoJobListApiView(generics.ListAPIView):
    """指定代码库任务列表接口

    ### get
    应用场景：获取指定项目任务列表详情
    """
    serializer_class = serializers.JobSerializer
    permission_classes = [RepositoryUserPermission]
    filter_backends = (DjangoFilterBackend,)
    filterset_class = filters.JobFilterSet

    def get_queryset(self):
        repo_id = self.kwargs["repo_id"]
        return models.Job.objects.select_related("project__repo").filter(project__repo_id=repo_id).order_by("-id")


class RepoJobDetailApiView(generics.RetrieveAPIView):
    """指定代码库任务详情接口

    ### get
    应用场景：获取项目指定扫描job的详情
    """
    serializer_class = serializers.JobSerializer
    permission_classes = [RepositoryUserPermission]

    def get_object(self):
        repo_id = self.kwargs["repo_id"]
        job_id = self.kwargs["job_id"]
        return get_object_or_404(models.Job, id=job_id, project__repo_id=repo_id)


class ProjectJobListApiView(generics.ListAPIView, ProjectBaseAPIView):
    """项目任务列表接口

    ### get
    应用场景：获取指定项目任务列表详情
    """
    serializer_class = serializers.JobCodeLineSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_class = filters.JobFilterSet

    def get_queryset(self):
        project = self.get_project()
        return models.Job.objects.select_related("project__repo").filter(project_id=project.id).order_by("-id")


class ProjectJobDetailApiView(generics.RetrieveAPIView, ProjectBaseAPIView):
    """项目任务详情接口

    ### get
    应用场景：获取指定项目指定任务详情
    """
    serializer_class = serializers.JobSerializer
    queryset = models.Job.objects.all()

    def get_object(self):
        project = self.get_project()
        job_id = self.kwargs["job_id"]
        return get_object_or_404(models.Job, id=job_id, project_id=project.id)


class ProjectJobApiView(generics.GenericAPIView):
    """任务关闭接口
    使用对象：服务内部

    ### put
    应用场景：Job JobClosed 的回调
    """
    schema = None
    authentication_classes = [ServerAPIAuthentication]
    serializer_class = serializers.JobClosedSerializer

    def put(self, request, **kwargs):
        project = get_object_or_404(models.Project, id=kwargs["project_id"])
        slz = self.get_serializer(data=request.data)
        if slz.is_valid(raise_exception=True):
            logger.info("[Job: %d] 开始执行回调..." % kwargs["job_id"])
            try:
                core.JobCloseHandler.job_closed(
                    kwargs["job_id"], slz.validated_data["result_code"], slz.validated_data["result_msg"],
                    slz.validated_data["result_data"], slz.validated_data.get("result_path"))
                return Response("job_closed")
            except CDErrorBase as e:
                return Response(e.data, status=status.HTTP_400_BAD_REQUEST)


class ProjectScanJobInitApiView(generics.GenericAPIView, ProjectBaseAPIView):
    """项目扫描初始化
    使用对象：节点

    ### get
    应用场景：获取项目扫描配置的api，供节点端离线扫描使用

    ### post
    应用场景：创建新的扫描任务，仅做初始化
    """
    schema = None
    authentication_classes = [TCANodeTokenBackend]
    serializer_class = ScanJobInitSerializer

    def post(self, request, **kwargs):
        project = self.get_project()
        if not request.user.is_superuser:
            schemeperm = ScanSchemePerm.objects.filter(scan_scheme=project.scan_scheme).first()
            if schemeperm and schemeperm.execute_scope == ScanSchemePerm.ScopeEnum.PRIVATE \
               and not schemeperm.check_user_execute_manager_perm(request.user):
                logger.error("本地扫描/CI流水线，代码库内创建分支项目/启动分支项目扫描无权限：%s" % request.user)
                raise PermissionDenied("您没有执行该操作的权限，该扫描方案已私有化，您不在该方案权限配置的关联分支项目权限成员列表中！！！")
        slz = self.get_serializer(data=request.data)
        if slz.is_valid(raise_exception=True):
            logger.info("参数校验通过，开始初始化任务，参数如下：")
            logger.info(json.dumps(slz.validated_data, indent=4))
            try:
                job_id, scan_id, task_infos = codeproj_core.create_local_scan(
                    project=project, creator=UserManager.get_username(request.user),
                    scan_data=slz.validated_data,
                    created_from=slz.validated_data.get("created_from", "codedog_client"))
                return Response({"job": job_id, "scan": scan_id, "tasks": task_infos})
            except CDErrorBase as e:
                return Response({"cd_error": e.data}, status=status.HTTP_400_BAD_REQUEST)


class ProjectJobFinishApiView(generics.GenericAPIView, ProjectBaseAPIView):
    """项目本地扫描完成，上报结果
    使用对象：节点

    ### post
    应用场景：上报本地扫描的任务结果
    """
    schema = None
    authentication_classes = [TCANodeTokenBackend]
    serializer_class = ScanJobCreateSerializer

    def post(self, request, **kwargs):
        project = self.get_project()
        job = get_object_or_404(models.Job, id=kwargs["job_id"], project_id=kwargs["project_id"])
        if not request.user.is_superuser:
            schemeperm = ScanSchemePerm.objects.filter(scan_scheme=project.scan_scheme).first()
            if schemeperm and schemeperm.execute_scope == ScanSchemePerm.ScopeEnum.PRIVATE \
               and not schemeperm.check_user_execute_manager_perm(request.user):
                logger.error("本地扫描/CI流水线，代码库内创建分支项目/启动分支项目扫描无权限：%s" % request.user)
                raise PermissionDenied("您没有执行该操作的权限，该扫描方案已私有化，您不在该方案权限配置的关联分支项目权限成员列表中！！！")
        slz = self.get_serializer(data=request.data)
        if slz.is_valid(raise_exception=True):
            logger.info("参数校验通过，开始结束任务，参数如下：")
            logger.info(json.dumps(request.data, indent=4))
            try:
                job_id, scan_id = codeproj_core.finish_job_from_client(
                    job, project, slz.validated_data, puppy_create=True)
                return Response({"job": job_id, "scan": scan_id})
            except CDErrorBase as e:
                return Response(e.data, status=status.HTTP_400_BAD_REQUEST)


class TaskProgressApiView(generics.ListCreateAPIView):
    """指定task进度接口

    ### get
    应用场景：获取指定task的进度

    ### post
    应用场景：上报指定task的进度数据
    """
    authentication_classes = [TCANodeTokenBackend]
    serializer_class = serializers.TaskProgressSerializer

    def get_queryset(self):
        return models.TaskProgress.objects.filter(task__id=int(self.kwargs["task_id"]))


class TaskDetailApiView(generics.GenericAPIView):
    """指定task详情接口

    ### put
    应用场景：上报task结果
    """
    schema = None
    authentication_classes = [TCANodeTokenBackend]
    serializer_class = serializers.TaskResultSerializer

    def put(self, request, job_id, task_id):
        task = get_object_or_404(models.Task, id=task_id)
        logger.info("[Job: %s][Task: %s] 收到上报结果请求，执行节点：%s" % (
            job_id, task_id, task.node))
        logger.info(json.dumps(request.data, indent=2))
        slz = self.get_serializer(data=request.data)
        if slz.is_valid(raise_exception=True):
            core.save_task_result(task_id, slz.validated_data["task_version"],
                                  slz.validated_data["result_code"],
                                  slz.validated_data["result_msg"],
                                  slz.validated_data["result_data_url"],
                                  slz.validated_data["log_url"],
                                  slz.validated_data["processes"])
            if errcode.is_success(slz.validated_data["result_code"]):
                core.close_job(task.job_id)
            else:
                core.revoke_job(task.job, slz.validated_data["result_code"], slz.validated_data["result_msg"])
            return Response(slz.data)


class JobTasksBeatApiView(APIView):
    """指定Task的心跳上报接口

    ### post
    应用场景：更新job下所有task的心跳时间
    """
    schema = None
    authentication_classes = [TCANodeTokenBackend]

    def post(self, request, job_id):
        task_ids = list(models.Task.objects.filter(job_id=job_id).exclude(
            state=models.Task.StateEnum.CLOSED).values_list("id", flat=True))
        task_num = models.Task.objects.filter(id__in=task_ids).update(last_beat_time=now())
        job_num = models.Job.objects.filter(id=job_id).exclude(
            state=models.Task.StateEnum.CLOSED).update(last_beat_time=now())
        return Response({"nrows": task_num, "job_nrows": job_num})


class JobApiView(generics.RetrieveUpdateAPIView):
    """指定Job详情接口

    ### get
    应用场景：获取指定job的详情

    ###put
    应用场景：修改job的字段内容
    """
    schema = None
    authentication_classes = [TCANodeTokenBackend]
    queryset = models.Job.objects.all()
    serializer_class = serializers.JobCodeLineSerializer
    lookup_url_kwarg = "job_id"


class JobTasksApiView(generics.ListAPIView):
    """指定Job的task列表查询接口

    ### get
    应用场景：获取Job的Task列表
    """
    schema = None
    serializer_class = serializers.TaskSerializer

    def get_queryset(self):
        return models.Task.objects.filter(job_id=self.kwargs["job_id"]).order_by("-id")
